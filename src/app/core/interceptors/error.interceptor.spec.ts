import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../api/api.config';
import { API_ENDPOINTS } from '../api/api-endpoints';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';

describe('authentication error interceptor', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let client: HttpClient;
  const protectedUrl = `${API_CONFIG.apiRoot}/protected-resource`;
  const session = {
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
    expiresInSeconds: 900,
    user: {
      id: 'user-7', fullName: 'Test Admin', email: 'admin@example.com',
      role: 'DISTRIBUTOR_ADMIN', organizationId: 'organization-12',
      organizationName: 'Test Distribution', organizationtype: 'DISTRIBUTOR',
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    window.sessionStorage.setItem('logiflow.accessToken', 'expired-access-token');
    window.sessionStorage.setItem('logiflow.refreshToken', 'valid-refresh-token');
  });

  afterEach(() => {
    http.verify();
    window.sessionStorage.clear();
  });

  it('shares one refresh across simultaneous 401 responses and retries each request once', () => {
    const results: unknown[] = [];
    client.get(protectedUrl).subscribe((value) => results.push(value));
    client.get(protectedUrl).subscribe((value) => results.push(value));
    const initial = http.match(protectedUrl);
    expect(initial).toHaveLength(2);
    initial.forEach((request) => request.flush(null, { status: 401, statusText: 'Unauthorized' }));

    const refresh = http.expectOne(API_ENDPOINTS.auth.refresh);
    expect(refresh.request.body).toEqual({ refreshToken: 'valid-refresh-token' });
    refresh.flush(session);

    const retried = http.match(protectedUrl);
    expect(retried).toHaveLength(2);
    expect(retried.map((request) => request.request.headers.get('Authorization')))
      .toEqual(['Bearer rotated-access-token', 'Bearer rotated-access-token']);
    retried.forEach((request, index) => request.flush({ ok: index }));
    expect(results).toEqual([{ ok: 0 }, { ok: 1 }]);
    expect(auth.user()?.organization.type).toBe('DISTRIBUTOR');
  });

  it('does not refresh or clear a session for a 403 response', () => {
    let status = 0;
    client.get(protectedUrl).subscribe({
      error: (error) => status = error.status,
    });
    http.expectOne(protectedUrl).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
    http.expectNone(API_ENDPOINTS.auth.refresh);
    expect(auth.accessToken).toBe('expired-access-token');
    expect(window.sessionStorage.getItem('logiflow.refreshToken')).toBe('valid-refresh-token');
  });

  it('clears authentication when the refresh token is expired or revoked', () => {
    let failed = false;
    client.get(protectedUrl).subscribe({ error: () => failed = true });
    http.expectOne(protectedUrl).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(API_ENDPOINTS.auth.refresh).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(API_ENDPOINTS.auth.logout).flush(null);
    expect(failed).toBe(true);
    expect(auth.accessToken).toBeNull();
    expect(window.sessionStorage.getItem('logiflow.refreshToken')).toBeNull();
    expect(auth.sessionEnd()?.reason).toBe('refresh-failed');
  });

  it('treats a revoked account refresh response as authentication loss', () => {
    client.get(protectedUrl).subscribe({ error: () => undefined });
    http.expectOne(protectedUrl).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(API_ENDPOINTS.auth.refresh).flush(null, { status: 403, statusText: 'Forbidden' });
    http.expectOne(API_ENDPOINTS.auth.logout).flush(null);
    expect(auth.accessToken).toBeNull();
    expect(auth.sessionEnd()?.reason).toBe('revoked');
  });
});
