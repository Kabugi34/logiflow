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
    window.localStorage.removeItem('logiflow.distributor.purchaseCart.v2.organization-12');
    vi.useRealTimers();
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

  it('silently refreshes shortly before the access token expires', async () => {
    vi.useFakeTimers();
    service.login('admin@example.com', 'secret-password').subscribe();
    http.expectOne(API_ENDPOINTS.auth.login).flush({ ...session, expiresInSeconds: 90 });
    const lastActivity = window.sessionStorage.getItem('logiflow.session.lastActivityAt');

    await vi.advanceTimersByTimeAsync(30_000);
    const refreshRequest = http.expectOne(API_ENDPOINTS.auth.refresh);
    refreshRequest.flush({ ...session, accessToken: 'proactively-refreshed-access', expiresInSeconds: 900 });
    expect(service.accessToken).toBe('proactively-refreshed-access');
    expect(window.sessionStorage.getItem('logiflow.session.lastActivityAt')).toBe(lastActivity);
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
      representativeRole: 'Operations Manager',
      country: 'Kenya',
      registrationNumber: 'CPR-123456',
      taxIdentifier: 'P123456789Z',
      contactEmail: 'admin@example.com',
      organizationEmail: 'ops@example.com',
      phoneNumber: '+254700000000',
      incorporationCertificate: new File(['incorporation'], 'incorporation.pdf', { type: 'application/pdf' }),
      taxCertificate: new File(['tax'], 'kra.pdf', { type: 'application/pdf' }),
      authorizedRepresentative: true
    }).subscribe();

    const request = http.expectOne(API_ENDPOINTS.auth.accessRequest);
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(request.request.body.get('organizationName')).toBe('Apex Distribution');
    expect(request.request.body.get('fullName')).toBe('Test Admin');
    expect(request.request.body.get('representativeRole')).toBe('Operations Manager');
    expect(request.request.body.get('registrationNumber')).toBe('CPR-123456');
    expect(request.request.body.get('taxIdentifier')).toBe('P123456789Z');
    expect(request.request.body.get('incorporationCertificate')).toBeInstanceOf(File);
    expect(request.request.body.get('taxCertificate')).toBeInstanceOf(File);
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

  it('shows the inactivity warning after 18 minutes and validates Stay Signed In', async () => {
    vi.useFakeTimers();
    service.login('admin@example.com', 'secret-password').subscribe();
    http.expectOne(API_ENDPOINTS.auth.login).flush({ ...session, expiresInSeconds: 3600 });

    await vi.advanceTimersByTimeAsync(18 * 60_000);
    expect(service.sessionWarningVisible()).toBe(true);
    service.staySignedIn().subscribe((valid) => expect(valid).toBe(true));
    http.expectOne(API_ENDPOINTS.auth.me).flush(backendUser);
    expect(service.sessionWarningVisible()).toBe(false);
    expect(Number(window.sessionStorage.getItem('logiflow.session.lastActivityAt'))).toBe(Date.now());
  });

  it('clears the session after 20 minutes without activity', async () => {
    vi.useFakeTimers();
    service.login('admin@example.com', 'secret-password').subscribe();
    http.expectOne(API_ENDPOINTS.auth.login).flush({ ...session, expiresInSeconds: 3600 });

    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(service.user()).toBeNull();
    expect(window.sessionStorage.getItem('logiflow.accessToken')).toBeNull();
    http.expectOne(API_ENDPOINTS.auth.logout).flush(null);
    expect(service.sessionEnd()?.reason).toBe('idle');
  });

  it('enforces the persisted eight-hour absolute session limit on restore', () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem('logiflow.accessToken', 'existing-access-token');
    window.sessionStorage.setItem('logiflow.refreshToken', 'existing-refresh-token');
    window.sessionStorage.setItem('logiflow.session.startedAt', String(Date.now() - 8 * 60 * 60_000));
    window.sessionStorage.setItem('logiflow.session.organizationId', 'organization-12');

    service.restoreSession().subscribe((user) => expect(user).toBeNull());
    http.expectNone(API_ENDPOINTS.auth.me);
    http.expectOne(API_ENDPOINTS.auth.logout).flush(null);
    expect(service.sessionEnd()?.reason).toBe('absolute');
  });

  it('preserves the manufacturer workspace when restoring its authenticated user', () => {
    window.sessionStorage.setItem('logiflow.accessToken', 'existing-access-token');
    window.sessionStorage.setItem('logiflow.refreshToken', 'existing-refresh-token');
    service.restoreSession().subscribe((user) => {
      expect(user?.organization.type).toBe('MANUFACTURER');
      expect(user?.roles).toEqual(['MANUFACTURER_ADMIN']);
    });
    http.expectOne(API_ENDPOINTS.auth.me).flush({
      ...backendUser,
      role: 'MANUFACTURER_ADMIN',
      organizationId: 'manufacturer-1',
      organizationtype: 'MANUFACTURER',
    });
  });

  it('logs a manufacturer account out through the same revocation endpoint', () => {
    const manufacturer = {
      ...backendUser,
      role: 'MANUFACTURER_ADMIN',
      organizationId: 'manufacturer-1',
      organizationName: 'Test Manufacturer',
      organizationtype: 'MANUFACTURER' as const,
    };
    service.login('manufacturer@example.com', 'secret-password').subscribe((user) => {
      expect(user?.organization.type).toBe('MANUFACTURER');
    });
    http.expectOne(API_ENDPOINTS.auth.login).flush({
      ...session,
      refreshToken: 'manufacturer-refresh-token',
      user: manufacturer,
    });
    service.logout().subscribe();
    http.expectOne(API_ENDPOINTS.auth.logout).flush(null);
    expect(service.user()).toBeNull();
    expect(service.sessionEnd()?.workspace).toBe('MANUFACTURER');
  });

  it('clears the prior organization cache when the signed-in organization changes', () => {
    const cachedKey = 'logiflow.distributor.purchaseCart.v2.organization-12';
    window.localStorage.setItem(cachedKey, '{"lines":[]}');
    service.login('admin@example.com', 'secret-password').subscribe();
    http.expectOne(API_ENDPOINTS.auth.login).flush(session);
    service.login('manufacturer@example.com', 'secret-password').subscribe();
    http.expectOne(API_ENDPOINTS.auth.login).flush({
      ...session,
      accessToken: 'manufacturer-access-token',
      refreshToken: 'manufacturer-refresh-token',
      user: {
        ...backendUser,
        role: 'MANUFACTURER_ADMIN',
        organizationId: 'manufacturer-1',
        organizationName: 'Test Manufacturer',
        organizationtype: 'MANUFACTURER',
      },
    });
    expect(service.organizationChanged()).toBe(true);
    expect(window.localStorage.getItem(cachedKey)).toBeNull();
    expect(service.user()?.organization.type).toBe('MANUFACTURER');
  });
});
