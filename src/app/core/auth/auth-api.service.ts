import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../api/api-endpoints';
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
    return this.http.post<void>(API_ENDPOINTS.auth.accessRequest, {
      organizationType: payload.organizationType,
      organizationName: payload.organizationName,
      fullName: payload.contactName,
      personalEmail: payload.contactEmail,
      organizationEmail: payload.organizationEmail,
      phoneNumber: payload.phoneNumber
    });
  }

  activateAccount(payload: { email: string; token: string; password: string; confirmPassword: string }): Observable<void> {
    return this.http.post<void>(API_ENDPOINTS.auth.activate, {
      email: payload.email,
      token: payload.token,
      password: payload.password,
      confirmPassword: payload.confirmPassword
    });
  }

  requestActivationLink(email: string): Observable<void> {
    return this.http.post<void>(API_ENDPOINTS.auth.activationResend, { identifier: email });
  }

  login(identifier: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(
      API_ENDPOINTS.auth.login,
      { identifier: identifier.trim(), password }
    );
  }

  refresh(refreshToken: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(API_ENDPOINTS.auth.refresh, { refreshToken });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(API_ENDPOINTS.auth.logout, { refreshToken });
  }

  me(): Observable<AuthUserResponse> {
    return this.http.get<AuthUserResponse>(API_ENDPOINTS.auth.me);
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(API_ENDPOINTS.auth.passwordResetRequest, { identifier: email });
  }

  resetPassword(payload: { email: string; token: string; password: string }): Observable<void> {
    return this.http.post<void>(API_ENDPOINTS.auth.passwordReset, {
      identifier: payload.email,
      otp: payload.token,
      newPassword: payload.password
    });
  }
}
