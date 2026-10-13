import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../api/api.config';
import { User } from '../models/user.model';

export interface AuthSession {
  accessToken: string;
  user: User;
  orgType?: User['organization']['type'];
}

export interface AccessRequestPayload {
  organizationType: User['organization']['type'];
  organizationName: string;
  contactName: string;
  contactEmail: string;
  organizationEmail: string;
  phoneNumber: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  requestAccess(payload: AccessRequestPayload): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.accessRequest, API_CONFIG.apiRoot), {
      organizationType: payload.organizationType,
      organizationName: payload.organizationName,
      fullName: payload.contactName,
      personalEmail: payload.contactEmail,
      organizationEmail: payload.organizationEmail,
      phoneNumber: payload.phoneNumber
    });
  }

  activateAccount(payload: { email: string; token: string; password: string; confirmPassword: string }): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.activate, API_CONFIG.apiRoot), {
      email: payload.email,
      token: payload.token,
      password: payload.password,
      confirmPassword: payload.confirmPassword
    });
  }

  requestActivationLink(email: string): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.activationResend), { email });
  }

  login(identifier: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(
      this.url(API_CONFIG.auth.login, API_CONFIG.apiRoot),
      { identifier: identifier.trim(), password }
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.logout), {});
  }

  me(): Observable<User> {
    return this.http.get<User>(this.url(API_CONFIG.auth.me));
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.passwordResetRequest), { email });
  }

  resetPassword(payload: { email: string; token: string; password: string }): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.passwordReset), payload);
  }

  private url(path: string, baseUrl = API_CONFIG.baseUrl): string {
    return `${baseUrl}${path}`;
  }
}
