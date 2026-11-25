import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService, AccessRequestPayload, AuthSession, AuthUserResponse } from './auth-api.service';
import { OrganizationType } from '../models/organization.model';
import { UserRole } from '../models/role.model';
import { User } from '../models/user.model';

const ACCESS_TOKEN_KEY = 'logiflow.accessToken';
const REFRESH_TOKEN_KEY = 'logiflow.refreshToken';
const SESSION_STARTED_KEY = 'logiflow.session.startedAt';
const LAST_ACTIVITY_KEY = 'logiflow.session.lastActivityAt';
const ACCESS_EXPIRES_KEY = 'logiflow.session.accessExpiresAt';
const ORGANIZATION_KEY = 'logiflow.session.organizationId';
const CROSS_TAB_LOGOUT_KEY = 'logiflow.session.logout';
const IDLE_TIMEOUT_MS = 20 * 60_000;
const WARNING_BEFORE_IDLE_MS = 2 * 60_000;
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60_000;
const REFRESH_EARLY_MS = 60_000;

export type SessionEndReason = 'idle' | 'absolute' | 'refresh-failed' | 'revoked' | 'logout';

function isWorkspaceRole(role: string, organizationType: OrganizationType | null): role is UserRole {
  return (organizationType === 'MANUFACTURER'
      && (role === 'MANUFACTURER_ADMIN' || role === 'MANUFACTURER_STAFF'))
    || (organizationType === 'DISTRIBUTOR'
      && (role === 'DISTRIBUTOR_ADMIN' || role === 'DISTRIBUTOR_STAFF'));
}

function jwtTime(token: string | null, field: 'iat' | 'exp'): number | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as Record<string, unknown>;
    const value = decoded[field];
    return typeof value === 'number' && Number.isFinite(value) ? value * 1000 : null;
  } catch {
    return null;
  }
}

function sessionIssuedAt(accessToken: string, refreshToken: string): number | null {
  const timestamps = [jwtTime(accessToken, 'iat'), jwtTime(refreshToken, 'iat')]
    .filter((value): value is number => value !== null);
  return timestamps.length ? Math.min(...timestamps) : null;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly authApi = inject(AuthApiService);
  private readonly currentUser = signal<User | null>(null);
  private readonly warningVisible = signal(false);
  private readonly ended = signal<{ reason: SessionEndReason; workspace: OrganizationType | null } | null>(null);
  private readonly switchedOrganization = signal(false);
  private sessionRequest: Observable<User | null> | null = null;
  private refreshRequest: Observable<boolean> | null = null;
  private idleWarningTimer: number | undefined;
  private idleExpiryTimer: number | undefined;
  private absoluteExpiryTimer: number | undefined;
  private tokenRefreshTimer: number | undefined;
  private readonly channel: BroadcastChannel | null;
  private readonly storageListener = (event: StorageEvent) => {
    if (event.key === CROSS_TAB_LOGOUT_KEY && event.newValue) this.endSession('logout', false, false);
  };

  readonly user = this.currentUser.asReadonly();
  readonly sessionWarningVisible = this.warningVisible.asReadonly();
  readonly sessionEnd = this.ended.asReadonly();
  readonly organizationChanged = this.switchedOrganization.asReadonly();

  constructor() {
    this.channel = typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel('logiflow.session');
    this.channel?.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'LOGOUT') this.endSession(event.data.reason ?? 'logout', false, false);
    });
    if (typeof window !== 'undefined') window.addEventListener('storage', this.storageListener);
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('storage', this.storageListener);
    this.channel?.close();
    if (typeof window !== 'undefined') {
      for (const timer of [this.idleWarningTimer, this.idleExpiryTimer, this.absoluteExpiryTimer, this.tokenRefreshTimer]) {
        if (timer !== undefined) window.clearTimeout(timer);
      }
    }
  }

  get accessToken(): string | null {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  private get refreshToken(): string | null {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  hasSessionCredentials(): boolean {
    return !!this.accessToken || !!this.refreshToken;
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.some(assignedRole => assignedRole === role) ?? false;
  }

  requestAccess(payload: AccessRequestPayload): Observable<void> {
    return this.authApi.requestAccess({ ...payload, contactEmail: payload.contactEmail.trim(), organizationEmail: payload.organizationEmail.trim() });
  }

  activateAccount(payload: { email: string; token: string; password: string; confirmPassword: string }): Observable<void> {
    return this.authApi.activateAccount(payload);
  }

  login(email: string, password: string): Observable<User | null> {
    return this.authApi.login(email.trim().toLowerCase(), password).pipe(
      map(session => ({ session, user: this.normalizeUser(session.user) })),
      tap(({ session, user }) => {
        if (user && session.accessToken && session.refreshToken) this.storeSession(session, user, true);
        else this.clearSession();
      }),
      map(({ user }) => user),
    );
  }

  requestActivationLink(email: string): Observable<void> {
    return this.authApi.requestActivationLink(email.trim().toLowerCase());
  }

  restoreSession(): Observable<User | null> {
    if (this.currentUser() && this.isAbsoluteSessionExpired()) {
      this.endSession('absolute', true);
      return of(null);
    }
    if (this.currentUser()) return of(this.currentUser());
    if (!this.accessToken && !this.refreshToken) return of(null);
    if (this.isAbsoluteSessionExpired()) {
      this.endSession('absolute', true);
      return of(null);
    }
    if (this.sessionRequest) return this.sessionRequest;

    this.ensureSessionStart();
    const refreshToken = this.refreshToken;
    const restoredUser = this.accessToken
      ? this.authApi.me().pipe(
          map(response => this.setRestoredUser(response)),
          catchError(error => error instanceof HttpErrorResponse && error.status === 401 && refreshToken
            ? this.renewSession(refreshToken)
            : throwError(() => error)),
        )
      : refreshToken ? this.renewSession(refreshToken) : of(null);

    this.sessionRequest = restoredUser.pipe(
      tap(user => { if (user) this.beginSessionLifecycle(); }),
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 401 && (this.accessToken || this.refreshToken)) {
          this.endSession('revoked', true);
        }
        return throwError(() => error);
      }),
      finalize(() => this.sessionRequest = null),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.sessionRequest;
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.authApi.requestPasswordReset(email.trim().toLowerCase());
  }

  resetPassword(payload: { email: string; token: string; password: string }): Observable<void> {
    return this.authApi.resetPassword(payload);
  }

  logout(): Observable<void> {
    this.endSession('logout', true);
    return of(void 0);
  }

  clearUser(): void {
    this.endSession('revoked', true);
  }

  /** Single-flight silent refresh used by proactive timers and 401 retries. */
  refreshAccessToken(): Observable<boolean> {
    if (this.isAbsoluteSessionExpired()) {
      this.endSession('absolute', true);
      return throwError(() => new Error('The absolute session limit has been reached.'));
    }
    if (this.refreshRequest) return this.refreshRequest;
    const token = this.refreshToken;
    if (!token) return throwError(() => new Error('No refresh token is available.'));
    this.refreshRequest = this.authApi.refresh(token).pipe(
      map(session => ({ session, user: this.normalizeUser(session.user) })),
      tap(({ session, user }) => {
        if (!user || !session.accessToken || !session.refreshToken) throw new Error('Refresh response did not contain a valid workspace session.');
        const currentOrg = this.currentUser()?.organization.id?.toString() ?? this.getStoredOrganizationId();
        if (currentOrg && currentOrg !== user.organization.id.toString()) {
          throw new Error('The refreshed session belongs to a different organization.');
        }
        this.storeSession(session, user);
        this.beginSessionLifecycle();
      }),
      map(() => true),
      catchError(error => {
        this.endSession(error instanceof HttpErrorResponse && error.status === 403 ? 'revoked' : 'refresh-failed', true);
        return throwError(() => error);
      }),
      finalize(() => this.refreshRequest = null),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshRequest;
  }

  noteUserActivity(): void {
    if (!this.currentUser()) return;
    const lastActivity = typeof window === 'undefined'
      ? Date.now()
      : Number(window.sessionStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
    if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
      this.endSession('idle', true);
      return;
    }
    if (this.isAbsoluteSessionExpired()) {
      if (this.currentUser()) this.endSession('absolute', true);
      return;
    }
    if (typeof window !== 'undefined') window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    this.scheduleIdleTimers();
  }

  staySignedIn(): Observable<boolean> {
    if (this.isAbsoluteSessionExpired()) {
      this.endSession('absolute', true);
      return of(false);
    }
    const expiry = this.getAccessExpiry();
    const validate = expiry !== null && expiry - Date.now() < 90_000
      ? this.refreshAccessToken()
      : this.authApi.me().pipe(
          map(response => !!this.setRestoredUser(response)),
          catchError(error => error instanceof HttpErrorResponse && error.status === 401
            ? this.refreshAccessToken()
            : throwError(() => error)),
        );
    return validate.pipe(tap(valid => {
      if (valid) {
        this.noteUserActivity();
      }
    }));
  }

  private normalizeUser(response: AuthUserResponse): User | null {
    const role = response?.role;
    const organizationType = response?.organizationtype;
    if (!response?.id || !response.organizationId || !organizationType || !isWorkspaceRole(role, organizationType)) return null;
    return {
      id: response.id,
      name: response.fullName ?? '',
      email: response.email ?? '',
      roles: [role],
      organization: { id: response.organizationId, name: response.organizationName ?? '', type: organizationType },
    };
  }

  private setRestoredUser(response: AuthUserResponse): User | null {
    const user = this.normalizeUser(response);
    if (user) {
      const storedOrg = this.getStoredOrganizationId();
      if (storedOrg && storedOrg !== user.organization.id.toString()) {
        this.endSession('revoked', true);
        return null;
      }
      this.currentUser.set(user);
      this.storeOrganization(user);
    } else this.endSession('revoked', true);
    return user;
  }

  private renewSession(refreshToken: string): Observable<User | null> {
    return this.authApi.refresh(refreshToken).pipe(
      map(session => ({ session, user: this.normalizeUser(session.user) })),
      tap(({ session, user }) => {
        if (user && session.accessToken && session.refreshToken) {
          const storedOrg = this.getStoredOrganizationId();
          if (storedOrg && storedOrg !== user.organization.id.toString()) throw new Error('Refreshed organization does not match the active session.');
          this.storeSession(session, user);
          this.beginSessionLifecycle();
        } else this.endSession('revoked', true);
      }),
      map(({ user }) => user),
      catchError(error => {
        this.endSession(error instanceof HttpErrorResponse && error.status === 403 ? 'revoked' : 'refresh-failed', true);
        return throwError(() => error);
      }),
    );
  }

  private storeSession(session: AuthSession, user: User, newLogin = false): void {
    if (typeof window !== 'undefined') {
      const storedOrg = this.getStoredOrganizationId();
      this.switchedOrganization.set(newLogin && !!storedOrg && storedOrg !== user.organization.id.toString());
      if (storedOrg && storedOrg !== user.organization.id.toString()) this.clearOrganizationCache(storedOrg);
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
      if (newLogin || !window.sessionStorage.getItem(SESSION_STARTED_KEY)) {
        const issuedAt = sessionIssuedAt(session.accessToken, session.refreshToken);
        window.sessionStorage.setItem(SESSION_STARTED_KEY, String(issuedAt ?? Date.now()));
      }
      if (newLogin || !window.sessionStorage.getItem(LAST_ACTIVITY_KEY)) {
        window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      }
      const expiry = jwtTime(session.accessToken, 'exp')
        ?? (typeof session.expiresInSeconds === 'number' ? Date.now() + session.expiresInSeconds * 1000 : Date.now() + 15 * 60_000);
      window.sessionStorage.setItem(ACCESS_EXPIRES_KEY, String(expiry));
      window.sessionStorage.setItem(ORGANIZATION_KEY, user.organization.id.toString());
    }
    this.currentUser.set(user);
    this.ended.set(null);
    if (newLogin) this.beginSessionLifecycle();
  }

  private storeOrganization(user: User): void {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(ORGANIZATION_KEY, user.organization.id.toString());
  }

  private ensureSessionStart(): void {
    if (typeof window === 'undefined' || window.sessionStorage.getItem(SESSION_STARTED_KEY)) return;
    const issuedAt = sessionIssuedAt(this.accessToken ?? '', this.refreshToken ?? '');
    window.sessionStorage.setItem(SESSION_STARTED_KEY, String(issuedAt ?? Date.now()));
  }

  private getAccessExpiry(): number | null {
    const value = typeof window === 'undefined' ? null : window.sessionStorage.getItem(ACCESS_EXPIRES_KEY);
    const stored = value ? Number(value) : NaN;
    return Number.isFinite(stored) ? stored : jwtTime(this.accessToken, 'exp');
  }

  private isAbsoluteSessionExpired(): boolean {
    if (typeof window === 'undefined') return false;
    const startedAt = Number(window.sessionStorage.getItem(SESSION_STARTED_KEY));
    if (!Number.isFinite(startedAt) || startedAt <= 0) return false;
    return Date.now() - startedAt >= ABSOLUTE_TIMEOUT_MS;
  }

  private beginSessionLifecycle(): void {
    if (this.isAbsoluteSessionExpired()) {
      this.endSession('absolute', true);
      return;
    }
    this.scheduleTokenRefresh();
    this.scheduleIdleTimers();
    if (typeof window !== 'undefined') {
      if (this.absoluteExpiryTimer !== undefined) window.clearTimeout(this.absoluteExpiryTimer);
      const startedAt = Number(window.sessionStorage.getItem(SESSION_STARTED_KEY)) || Date.now();
      this.absoluteExpiryTimer = window.setTimeout(() => this.endSession('absolute', true), Math.max(0, startedAt + ABSOLUTE_TIMEOUT_MS - Date.now()));
    }
  }

  private scheduleTokenRefresh(): void {
    if (typeof window === 'undefined') return;
    if (this.tokenRefreshTimer !== undefined) window.clearTimeout(this.tokenRefreshTimer);
    const expiry = this.getAccessExpiry();
    if (!expiry || !this.currentUser()) return;
    const wait = Math.max(0, expiry - Date.now() - REFRESH_EARLY_MS);
    this.tokenRefreshTimer = window.setTimeout(() => {
      if (this.currentUser() && !this.isAbsoluteSessionExpired()) {
        this.refreshAccessToken().subscribe({ error: () => undefined });
      }
    }, wait);
  }

  private scheduleIdleTimers(): void {
    if (typeof window === 'undefined' || !this.currentUser()) return;
    if (this.idleWarningTimer !== undefined) window.clearTimeout(this.idleWarningTimer);
    if (this.idleExpiryTimer !== undefined) window.clearTimeout(this.idleExpiryTimer);
    const lastActivity = Number(window.sessionStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
    const elapsed = Math.max(0, Date.now() - lastActivity);
    if (elapsed >= IDLE_TIMEOUT_MS) {
      this.endSession('idle', true);
      return;
    }
    const warningIn = IDLE_TIMEOUT_MS - WARNING_BEFORE_IDLE_MS - elapsed;
    this.warningVisible.set(warningIn <= 0);
    if (warningIn > 0) this.idleWarningTimer = window.setTimeout(() => this.warningVisible.set(true), warningIn);
    this.idleExpiryTimer = window.setTimeout(() => this.endSession('idle', true), IDLE_TIMEOUT_MS - elapsed);
  }

  private endSession(reason: SessionEndReason, revoke: boolean, announce = true): void {
    const workspace = this.currentUser()?.organization.type
      ?? (typeof window !== 'undefined' ? window.sessionStorage.getItem(ORGANIZATION_KEY) as OrganizationType | null : null);
    const refresh = revoke ? this.refreshToken : null;
    this.clearSession();
    if (announce && typeof window !== 'undefined') {
      this.channel?.postMessage({ type: 'LOGOUT', reason });
      try { window.localStorage.setItem(CROSS_TAB_LOGOUT_KEY, `${Date.now()}-${Math.random()}`); } catch { /* BroadcastChannel remains the primary path. */ }
    }
    if (refresh) {
      this.authApi.logout(refresh).subscribe({ error: () => undefined });
    }
    this.ended.set({ reason, workspace });
  }

  private clearSession(): void {
    const organizationId = this.getStoredOrganizationId();
    this.currentUser.set(null);
    this.warningVisible.set(false);
    if (typeof window !== 'undefined') {
      for (const timer of [this.idleWarningTimer, this.idleExpiryTimer, this.absoluteExpiryTimer, this.tokenRefreshTimer]) {
        if (timer !== undefined) window.clearTimeout(timer);
      }
      this.idleWarningTimer = this.idleExpiryTimer = this.absoluteExpiryTimer = this.tokenRefreshTimer = undefined;
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      window.sessionStorage.removeItem(SESSION_STARTED_KEY);
      window.sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      window.sessionStorage.removeItem(ACCESS_EXPIRES_KEY);
      window.sessionStorage.removeItem(ORGANIZATION_KEY);
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith('logiflow.checkout.payment.')) window.sessionStorage.removeItem(key);
      }
      if (organizationId) this.clearOrganizationCache(organizationId);
    }
  }

  private getStoredOrganizationId(): string | null {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(ORGANIZATION_KEY);
  }

  private clearOrganizationCache(organizationId: string): void {
    if (typeof window === 'undefined') return;
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('logiflow.') && key.includes(organizationId)) window.localStorage.removeItem(key);
      }
    } catch { /* Storage can be unavailable in privacy-restricted contexts. */ }
  }
}
