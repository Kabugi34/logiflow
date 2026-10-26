import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService, AccessRequestPayload, AuthSession, AuthUserResponse } from './auth-api.service';
import { OrganizationType } from '../models/organization.model';
import { UserRole } from '../models/role.model';
import { User } from '../models/user.model';

const ACCESS_TOKEN_KEY = 'logiflow.accessToken';
const REFRESH_TOKEN_KEY = 'logiflow.refreshToken';

function isWorkspaceRole(role: string, organizationType: OrganizationType | null): role is UserRole {
  return (organizationType === 'MANUFACTURER'
      && (role === 'MANUFACTURER_ADMIN' || role === 'MANUFACTURER_STAFF'))
    || (organizationType === 'DISTRIBUTOR'
      && (role === 'DISTRIBUTOR_ADMIN' || role === 'DISTRIBUTOR_STAFF'));
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly currentUser = signal<User | null>(null);
  private sessionRequest: Observable<User | null> | null = null;

  readonly user = this.currentUser.asReadonly();

  get accessToken(): string | null {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  private get refreshToken(): string | null {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.some(assignedRole => assignedRole === role) ?? false;
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

  login(email: string, password: string): Observable<User | null> {
    return this.authApi.login(email.trim().toLowerCase(), password).pipe(
      map(session => ({ session, user: this.normalizeUser(session.user) })),
      tap(({ session, user }) => {
        if (user && session.accessToken && session.refreshToken) {
          this.storeSession(session, user);
        } else {
          this.clearSession();
        }
      }),
      map(({ user }) => user)
    );
  }

  requestActivationLink(email: string): Observable<void> {
    return this.authApi.requestActivationLink(email.trim().toLowerCase());
  }

  restoreSession(): Observable<User | null> {
    if (this.currentUser()) return of(this.currentUser());
    if (!this.accessToken && !this.refreshToken) return of(null);
    if (this.sessionRequest) return this.sessionRequest;

    const refreshToken = this.refreshToken;
    const restoredUser = this.accessToken
      ? this.authApi.me().pipe(
          map(response => this.setRestoredUser(response)),
          catchError(error => {
            if (error instanceof HttpErrorResponse && error.status === 401 && refreshToken) {
              return this.renewSession(refreshToken);
            }
            return throwError(() => error);
          })
        )
      : refreshToken
        ? this.renewSession(refreshToken)
        : of(null);

    this.sessionRequest = restoredUser.pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) {
          this.clearSession();
        }
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
    const refreshToken = this.refreshToken;
    const logoutRequest = refreshToken
      ? this.authApi.logout(refreshToken)
      : of(void 0);
    return logoutRequest.pipe(
      catchError(() => of(void 0)),
      tap(() => this.clearSession())
    );
  }

  clearUser(): void {
    this.clearSession();
  }

  private normalizeUser(response: AuthUserResponse): User | null {
    const role = response?.role;
    const organizationType = response?.organizationtype;
    if (
      !response?.id ||
      !response.organizationId ||
      !organizationType ||
      !isWorkspaceRole(role, organizationType)
    ) {
      return null;
    }

    return {
      id: response.id,
      name: response.fullName ?? '',
      email: response.email ?? '',
      roles: [role],
      organization: {
        id: response.organizationId,
        name: response.organizationName ?? '',
        type: organizationType
      }
    };
  }

  private setRestoredUser(response: AuthUserResponse): User | null {
    const user = this.normalizeUser(response);
    if (user) {
      this.currentUser.set(user);
    } else {
      this.clearSession();
    }
    return user;
  }

  private renewSession(refreshToken: string): Observable<User | null> {
    return this.authApi.refresh(refreshToken).pipe(
      map(session => ({ session, user: this.normalizeUser(session.user) })),
      tap(({ session, user }) => {
        if (user && session.accessToken && session.refreshToken) {
          this.storeSession(session, user);
        } else {
          this.clearSession();
        }
      }),
      map(({ user }) => user)
    );
  }

  private storeSession(session: AuthSession, user: User): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    }
    this.currentUser.set(user);
  }

  private clearSession(): void {
    this.currentUser.set(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }
}
