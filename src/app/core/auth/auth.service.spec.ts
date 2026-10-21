import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../api/api-endpoints';
import { AuthUserResponse } from './auth-api.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const backendUser: AuthUserResponse = {
    id: 'user-7',
    fullName: 'Test Admin',
    email: 'admin@example.com',
    role: 'DISTRIBUTOR_ADMIN',
    organizationId: 'organization-12',
    organizationName: 'Test Distribution',
    organizationtype: 'DISTRIBUTOR'
  };

  const session = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenType: 'Bearer',
    expiresInSeconds: 900,
    redirectPath: '/distributor/dashboard',
    user: backendUser
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    http.verify();
    window.sessionStorage.clear();
  });

  it('stores backend tokens and normalizes the login user', () => {
    service.login(' ADMIN@example.com ', 'secret-password').subscribe(user => {
      expect(user).toEqual({
        id: 'user-7',
        name: 'Test Admin',
        email: 'admin@example.com',
        roles: ['DISTRIBUTOR_ADMIN'],
        organization: {
          id: 'organization-12',
          name: 'Test Distribution',
          type: 'DISTRIBUTOR'
        }
      });
      expect(service.user()).toEqual(user);
      expect(service.isAuthenticated()).toBe(true);
    });

    const request = http.expectOne(API_ENDPOINTS.auth.login);
    expect(request.request.body).toEqual({ identifier: 'admin@example.com', password: 'secret-password' });
    request.flush(session);
    expect(window.sessionStorage.getItem('logiflow.accessToken')).toBe('test-access-token');
    expect(window.sessionStorage.getItem('logiflow.refreshToken')).toBe('test-refresh-token');
  });

  it('rejects unsupported or organization-mismatched roles without granting a workspace', () => {
    service.login('admin@example.com', 'secret-password').subscribe(user => {
      expect(user).toBeNull();
      expect(service.user()).toBeNull();
      expect(window.sessionStorage.getItem('logiflow.accessToken')).toBeNull();
    });

    http.expectOne(API_ENDPOINTS.auth.login).flush({
      ...session,
      user: { ...backendUser, role: 'MANUFACTURER_ADMIN' }
    });
  });

  it('restores and normalizes the user from the backend me endpoint', () => {
    window.sessionStorage.setItem('logiflow.accessToken', 'existing-access-token');
    window.sessionStorage.setItem('logiflow.refreshToken', 'existing-refresh-token');

    service.restoreSession().subscribe(user => {
      expect(user?.roles).toEqual(['DISTRIBUTOR_ADMIN']);
      expect(user?.organization.type).toBe('DISTRIBUTOR');
    });

    const request = http.expectOne(API_ENDPOINTS.auth.me);
    request.flush(backendUser);
    expect(service.hasRole('DISTRIBUTOR_ADMIN')).toBe(true);
  });

  it('refreshes expired access tokens and stores the rotated session', () => {
    window.sessionStorage.setItem('logiflow.accessToken', 'expired-access-token');
    window.sessionStorage.setItem('logiflow.refreshToken', 'existing-refresh-token');

    service.restoreSession().subscribe(user => {
      expect(user?.email).toBe('admin@example.com');
    });

    http.expectOne(API_ENDPOINTS.auth.me).flush(null, {
      status: 401,
      statusText: 'Unauthorized'
    });
    const refreshRequest = http.expectOne(API_ENDPOINTS.auth.refresh);
    expect(refreshRequest.request.body).toEqual({ refreshToken: 'existing-refresh-token' });
    refreshRequest.flush(session);

    expect(window.sessionStorage.getItem('logiflow.accessToken')).toBe('test-access-token');
    expect(window.sessionStorage.getItem('logiflow.refreshToken')).toBe('test-refresh-token');
  });

  it('keeps refresh credentials when session restoration fails temporarily', () => {
    window.sessionStorage.setItem('logiflow.accessToken', 'existing-access-token');
    window.sessionStorage.setItem('logiflow.refreshToken', 'existing-refresh-token');

    service.restoreSession().subscribe({ error: () => undefined });
    http.expectOne(API_ENDPOINTS.auth.me).flush(null, {
      status: 503,
      statusText: 'Service Unavailable'
    });

    expect(window.sessionStorage.getItem('logiflow.accessToken')).toBe('existing-access-token');
    expect(window.sessionStorage.getItem('logiflow.refreshToken')).toBe('existing-refresh-token');
  });

  it('preserves the activation email, token, password, and confirmation payload', () => {
    service.activateAccount({
      email: 'admin@example.com',
      token: 'invite-token',
      password: 'new-password',
      confirmPassword: 'new-password'
    }).subscribe();

    const request = http.expectOne(API_ENDPOINTS.auth.activate);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'admin@example.com',
      token: 'invite-token',
      password: 'new-password',
      confirmPassword: 'new-password'
    });
    request.flush(null);
  });

  it('submits access requests to the configured API root', () => {
    service.requestAccess({
      organizationType: 'DISTRIBUTOR',
      organizationName: 'Apex Distribution',
      contactName: 'Test Admin',
      contactEmail: 'admin@example.com',
      organizationEmail: 'ops@example.com',
      phoneNumber: '+254700000000'
    }).subscribe();

    const request = http.expectOne(API_ENDPOINTS.auth.accessRequest);
    expect(request.request.body).toEqual({
      organizationType: 'DISTRIBUTOR',
      organizationName: 'Apex Distribution',
      fullName: 'Test Admin',
      personalEmail: 'admin@example.com',
      organizationEmail: 'ops@example.com',
      phoneNumber: '+254700000000'
    });
    request.flush(null);
  });

  it('sends the refresh token to backend logout and clears the local session', () => {
    window.sessionStorage.setItem('logiflow.accessToken', 'existing-access-token');
    window.sessionStorage.setItem('logiflow.refreshToken', 'existing-refresh-token');

    service.logout().subscribe(() => {
      expect(service.user()).toBeNull();
      expect(window.sessionStorage.getItem('logiflow.accessToken')).toBeNull();
      expect(window.sessionStorage.getItem('logiflow.refreshToken')).toBeNull();
    });

    const request = http.expectOne(API_ENDPOINTS.auth.logout);
    expect(request.request.body).toEqual({ refreshToken: 'existing-refresh-token' });
    request.flush(null);
  });
});
