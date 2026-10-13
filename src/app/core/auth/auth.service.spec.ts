import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../api/api.config';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const user: User = {
    id: 7,
    name: 'Test Admin',
    email: 'admin@example.com',
    roles: ['DISTRIBUTOR_ADMIN'],
    organization: { id: 12, name: 'Test Distribution', type: 'DISTRIBUTOR' }
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

  it('stores the token and authenticated user after login', () => {
    service.login(' ADMIN@example.com ', 'secret-password').subscribe(result => {
      expect(result).toEqual(user);
      expect(service.user()).toEqual(user);
      expect(service.isAuthenticated()).toBe(true);
    });

    const request = http.expectOne(`${API_CONFIG.apiRoot}${API_CONFIG.auth.login}`);
    expect(request.request.body).toEqual({ identifier: 'admin@example.com', password: 'secret-password' });
    request.flush({ accessToken: 'test-token', user });
    expect(window.sessionStorage.getItem('logiflow.accessToken')).toBe('test-token');
  });

  it('uses the backend orgType when normalizing the login user', () => {
    service.login('admin@example.com', 'secret-password').subscribe(result => {
      expect(result.organization.type).toBe('MANUFACTURER');
    });

    http.expectOne(`${API_CONFIG.apiRoot}${API_CONFIG.auth.login}`).flush({
      accessToken: 'test-token',
      orgType: 'MANUFACTURER',
      user: { ...user, organization: { ...user.organization, type: 'DISTRIBUTOR' } }
    });
  });

  it('submits an access request to the live access-request endpoint', () => {
    const payload = {
      organizationType: 'DISTRIBUTOR' as const,
      organizationName: 'Apex Distribution',
      contactName: 'Test Admin',
      contactEmail: 'admin@example.com',
      organizationEmail: 'ops@example.com',
      phoneNumber: '+254700000000'
    };

    service.requestAccess(payload).subscribe();

    const request = http.expectOne(`${API_CONFIG.apiRoot}${API_CONFIG.auth.accessRequest}`);
    expect(request.request.method).toBe('POST');
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

  it('activates an account at the live endpoint with the link token', () => {
    service.activateAccount({
      email: 'admin@example.com',
      token: 'invite-token',
      password: 'new-password',
      confirmPassword: 'new-password'
    }).subscribe();

    const request = http.expectOne(`${API_CONFIG.apiRoot}${API_CONFIG.auth.activate}`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'admin@example.com',
      token: 'invite-token',
      password: 'new-password',
      confirmPassword: 'new-password'
    });
    request.flush(null);
  });

  it('restores the authenticated user from the me endpoint', () => {
    window.sessionStorage.setItem('logiflow.accessToken', 'existing-token');

    service.restoreSession().subscribe(result => expect(result).toEqual(user));

    const request = http.expectOne(`${API_CONFIG.baseUrl}${API_CONFIG.auth.me}`);
    request.flush(user);
    expect(service.hasRole('DISTRIBUTOR_ADMIN')).toBe(true);
  });

  it('clears the local session when logout completes', () => {
    window.sessionStorage.setItem('logiflow.accessToken', 'existing-token');

    service.logout().subscribe(() => {
      expect(service.user()).toBeNull();
      expect(window.sessionStorage.getItem('logiflow.accessToken')).toBeNull();
    });

    const request = http.expectOne(`${API_CONFIG.baseUrl}${API_CONFIG.auth.logout}`);
    request.flush(null);
  });
});
