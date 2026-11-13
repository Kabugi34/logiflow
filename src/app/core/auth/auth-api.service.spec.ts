import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../api/api-endpoints';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService driver invitations', () => {
  let service: AuthApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads public invitation details and accepts with the backend request shape', () => {
    const token = 'public-invitation-token';
    service.getDriverInvitation(token).subscribe((details) => {
      expect(details.id).toBe('invitation-1');
      expect(details.role).toBe('DRIVER');
    });
    http.expectOne(API_ENDPOINTS.driverInvitation.details(token)).flush({
      id: 'invitation-1',
      fullName: 'Jordan Driver',
      email: 'jordan@example.com',
      role: 'DRIVER',
      organizationName: 'Example Distribution',
      organizationId: 'organization-1',
      status: 'PENDING',
      expiresAt: '2026-12-01T00:00:00Z',
    });

    service
      .acceptDriverInvitation(token, { phoneNumber: ' +254712345678 ', password: 'StrongPass123' })
      .subscribe((response) => expect(response.userId).toBe('user-1'));
    const accept = http.expectOne(API_ENDPOINTS.driverInvitation.accept(token));
    expect(accept.request.method).toBe('POST');
    expect(accept.request.body).toEqual({
      phoneNumber: '+254712345678',
      password: 'StrongPass123',
    });
    accept.flush({ userId: 'user-1', message: 'accepted' });
  });

  it('verifies a six-digit OTP and resends verification using the identifier contract', () => {
    service.verifyAccount(' +254712345678 ', '012345').subscribe();
    const verify = http.expectOne(API_ENDPOINTS.auth.verifyAccount);
    expect(verify.request.method).toBe('POST');
    expect(verify.request.body).toEqual({ identifier: '+254712345678', otp: '012345' });
    verify.flush({
      accessToken: 'access',
      refreshToken: 'refresh',
      redirectPath: null,
      user: {
        id: 'driver-1',
        role: 'DRIVER',
        organizationId: 'organization-1',
        organizationName: 'Example Distribution',
        organizationtype: 'DISTRIBUTOR',
      },
    });

    service.resendVerification(' +254712345678 ').subscribe();
    const resend = http.expectOne(API_ENDPOINTS.auth.activationResend);
    expect(resend.request.method).toBe('POST');
    expect(resend.request.body).toEqual({ identifier: '+254712345678' });
    resend.flush({ message: 'processed' });
  });
});
