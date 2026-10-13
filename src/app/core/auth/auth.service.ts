import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService, AccessRequestPayload, AuthSession } from './auth-api.service';
import { User } from '../models/user.model';

const ACCESS_TOKEN_KEY = 'logiflow.accessToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly currentUser = signal<User | null>(null);
  private sessionRequest: Observable<User | null> | null = null;

  readonly user = this.currentUser.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('logiflow.accounts');
      window.localStorage.removeItem('logiflow.currentUser');
      window.localStorage.removeItem('logiflow.accessRequests');
    }
  }

  get accessToken(): string | null {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.includes(role as User['roles'][number]) ?? false;
  }

  requestAccess(payload: AccessRequestPayload): Observable<void> {
    return this.authApi.requestAccess({
      ...payload,
      contactEmail: payload.contactEmail.trim(),
      organizationEmail: payload.organizationEmail.trim()
    });
  }

  activateAccount(payload: { email: string; token: string; password: string; confirmPassword: string }): Observable<void> {
    return this.authApi.activateAccount(payload);
  }

  login(email: string, password: string): Observable<User> {
    return this.authApi.login(email.trim().toLowerCase(), password).pipe(
      map(session => {
        const rawUser = session.user as User & { role?: string; roles?: string[] | string };
        const organizationType = session.orgType ?? rawUser.organization?.type;
        const suppliedRoles = rawUser.roles?.length
          ? rawUser.roles
          : rawUser.role ?? [];
        const roles = Array.isArray(suppliedRoles)
          ? suppliedRoles
          : [suppliedRoles];
        const normalizedRoles = roles.length
          ? roles
          : organizationType === 'MANUFACTURER'
            ? ['MANUFACTURER_ADMIN']
            : organizationType === 'DISTRIBUTOR'
              ? ['DISTRIBUTOR_ADMIN']
              : [];
        const user: User = {
          ...rawUser,
          roles: normalizedRoles as User['roles'],
          organization: {
            ...rawUser.organization,
            type: organizationType
          }
        };
        return { session, user };
      }),
      tap(({ session, user }) => this.storeSession({ ...session, user })),
      map(({ user }) => user)
    );
  }

  requestActivationLink(email: string): Observable<void> {
    return this.authApi.requestActivationLink(email.trim().toLowerCase());
  }

  restoreSession(): Observable<User | null> {
    if (this.currentUser()) return of(this.currentUser());
    if (!this.accessToken) return of(null);
    if (this.sessionRequest) return this.sessionRequest;

    this.sessionRequest = this.authApi.me().pipe(
      tap(user => this.currentUser.set(user)),
      map(user => user as User | null),
      catchError(error => {
        this.clearSession();
        return throwError(() => error);
      }),
      finalize(() => this.sessionRequest = null),
      shareReplay({ bufferSize: 1, refCount: false })
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
    return this.authApi.logout().pipe(
      catchError(() => of(void 0)),
      tap(() => this.clearSession())
    );
  }

  clearUser(): void {
    this.clearSession();
  }

  private storeSession(session: AuthSession): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    }
    this.currentUser.set(session.user);
  }

  private clearSession(): void {
    this.currentUser.set(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }
}
