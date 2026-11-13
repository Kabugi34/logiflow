import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../api/api-endpoints';
import { OrganizationType } from '../models/organization.model';
import {
  DriverInvitationAcceptanceResponse,
  DriverInvitationDetails,
} from '../models/driver-invitation.model';

export interface AuthUserResponse {
  id: string;
  fullName?: string | null;
  email?: string | null;
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
  representativeRole: string;
  country: string;
  registrationNumber: string;
  taxIdentifier: string;
  contactEmail: string;
  organizationEmail: string;
  phoneNumber: string;
  incorporationCertificate: File;
  taxCertificate: File;
  authorizedRepresentative: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  requestAccess(payload: AccessRequestPayload): Observable<void> {
    const form = new FormData();
    form.append('organizationType', payload.organizationType);
    form.append('organizationName', payload.organizationName.trim());
    form.append('fullName', payload.contactName.trim());
    form.append('representativeRole', payload.representativeRole.trim());
    form.append('country', payload.country.trim());
    form.append('registrationNumber', payload.registrationNumber.trim());
    form.append('taxIdentifier', payload.taxIdentifier.trim());
    form.append('personalEmail', payload.contactEmail.trim());
    form.append('organizationEmail', payload.organizationEmail.trim());
    form.append('phoneNumber', payload.phoneNumber.trim());
    form.append('incorporationCertificate', payload.incorporationCertificate);
    form.append('taxCertificate', payload.taxCertificate);
    form.append('authorizedRepresentative', String(payload.authorizedRepresentative));
    return this.http.post<void>(API_ENDPOINTS.auth.accessRequest, form);
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

  getDriverInvitation(token: string): Observable<DriverInvitationDetails> {
    return this.http.get<DriverInvitationDetails>(API_ENDPOINTS.driverInvitation.details(token));
  }

  acceptDriverInvitation(
    token: string,
    payload: { phoneNumber: string; password: string },
  ): Observable<DriverInvitationAcceptanceResponse> {
    return this.http.post<DriverInvitationAcceptanceResponse>(
      API_ENDPOINTS.driverInvitation.accept(token),
      { phoneNumber: payload.phoneNumber.trim(), password: payload.password },
    );
  }

  verifyAccount(identifier: string, otp: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(API_ENDPOINTS.auth.verifyAccount, {
      identifier: identifier.trim(),
      otp: otp.trim(),
    });
  }

  resendVerification(identifier: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(API_ENDPOINTS.auth.activationResend, {
      identifier: identifier.trim(),
    });
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
