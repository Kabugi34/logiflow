import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../api/api.config';
import { OrganizationType } from '../models/organization.model';

export interface AuthUserResponse {
  id: string;
  fullName: string;
  email: string;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationtype: OrganizationType | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  redirectPath: string | null;
  user: AuthUserResponse;
}

export interface AccessRequestPayload {
  organizationType: OrganizationType;
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
    return this.http.post<void>(this.url(API_CONFIG.auth.activationResend), { identifier: email });
  }

  login(identifier: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(
      this.url(API_CONFIG.auth.login, API_CONFIG.apiRoot),
      { identifier: identifier.trim(), password }
    );
  }

  refresh(refreshToken: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(this.url(API_CONFIG.auth.refresh), { refreshToken });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.logout), { refreshToken });
  }

  me(): Observable<AuthUserResponse> {
    return this.http.get<AuthUserResponse>(this.url(API_CONFIG.auth.me));
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.passwordResetRequest), { identifier: email });
  }

  resetPassword(payload: { email: string; token: string; password: string }): Observable<void> {
    return this.http.post<void>(this.url(API_CONFIG.auth.passwordReset), {
      identifier: payload.email,
      otp: payload.token,
      newPassword: payload.password
    });
  }

  private url(path: string, baseUrl = API_CONFIG.baseUrl): string {
    return `${baseUrl}${path}`;
  }
}
