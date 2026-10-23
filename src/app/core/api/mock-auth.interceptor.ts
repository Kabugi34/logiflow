import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { API_CONFIG } from './api.config';
import { API_ENDPOINTS } from './api-endpoints';

/**
 * Local development stand-in for the auth HTTP API. It deliberately returns
 * the same payloads as the real API so AuthService and feature code stay intact.
 * This is a demo convenience, not authentication or storage suitable for production.
 */
const demoUsers = [
  {
    id: 'demo-manufacturer-admin', fullName: 'Maya Manufacturer', email: 'manufacturer@logiflow.demo',
    role: 'MANUFACTURER_ADMIN', organizationId: 'demo-manufacturer', organizationName: 'Demo Manufacturer Ltd', organizationtype: 'MANUFACTURER'
  },
  {
    id: 'demo-distributor-admin', fullName: 'Daniel Distributor', email: 'distributor@logiflow.demo',
    role: 'DISTRIBUTOR_ADMIN', organizationId: 'demo-distributor', organizationName: 'Demo Distribution Ltd', organizationtype: 'DISTRIBUTOR'
  }
];

const DEMO_PASSWORD = 'LogiflowDemo1!';
const demoAccessTokens = new Map<string, typeof demoUsers[number]>();
const demoRefreshTokens = new Map<string, typeof demoUsers[number]>();

function json<T>(body: T, request: HttpRequest<unknown>, status = 200): HttpResponse<T> {
  return new HttpResponse({ body, status, url: request.url });
}

function unauthorized(request: HttpRequest<unknown>, message = 'Invalid email or password'): Observable<HttpEvent<unknown>> {
  return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized', error: { message }, url: request.url }));
}

function issueSession(user: typeof demoUsers[number], request: HttpRequest<unknown>): HttpResponse<unknown> {
  const accessToken = `mock-access-${crypto.randomUUID()}`;
  const refreshToken = `mock-refresh-${crypto.randomUUID()}`;
  demoAccessTokens.set(accessToken, user);
  demoRefreshTokens.set(refreshToken, user);
  return json({ accessToken, refreshToken, tokenType: 'Bearer', expiresInSeconds: 900, redirectPath: user.organizationtype === 'MANUFACTURER' ? '/manufacturer/dashboard' : '/distributor/dashboard', user }, request);
}

export const mockAuthInterceptor: HttpInterceptorFn = (request, next: HttpHandlerFn) => {
  if (!API_CONFIG.useMockAuth) return next(request);

  let url: URL;
  try { url = new URL(request.url); } catch { return next(request); }
  const api = new URL(API_CONFIG.apiRoot);
  if (url.origin !== api.origin) return next(request);

  const path = url.pathname.replace(/\/$/, '');
  if (request.method === 'POST' && path === new URL(API_ENDPOINTS.auth.login).pathname) {
    const body = request.body as { identifier?: string; password?: string };
    const user = demoUsers.find(candidate => candidate.email === body?.identifier?.trim().toLowerCase());
    return user && body?.password === DEMO_PASSWORD ? of(issueSession(user, request)) : unauthorized(request);
  }

  if (request.method === 'GET' && path === new URL(API_ENDPOINTS.auth.me).pathname) {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const user = token ? demoAccessTokens.get(token) : undefined;
    return user ? of(json(user, request)) : unauthorized(request, 'Mock access token is missing or expired');
  }

  if (request.method === 'POST' && path === new URL(API_ENDPOINTS.auth.refresh).pathname) {
    const token = (request.body as { refreshToken?: string })?.refreshToken;
    const user = token ? demoRefreshTokens.get(token) : undefined;
    if (!user || !token) return unauthorized(request, 'Mock refresh token is invalid');
    demoRefreshTokens.delete(token);
    return of(issueSession(user, request));
  }

  if (request.method === 'POST' && path === new URL(API_ENDPOINTS.auth.logout).pathname) {
    const token = (request.body as { refreshToken?: string })?.refreshToken;
    if (token) demoRefreshTokens.delete(token);
    return of(json(null, request));
  }

  // Keep account setup and password recovery flows navigable in a demo.
  if (request.method === 'POST' && [
    API_ENDPOINTS.auth.accessRequest, API_ENDPOINTS.auth.activate,
    API_ENDPOINTS.auth.activationResend, API_ENDPOINTS.auth.passwordResetRequest,
    API_ENDPOINTS.auth.passwordReset
  ].some(endpoint => path === new URL(endpoint).pathname)) {
    return of(json(null, request, 202));
  }

  return next(request);
};
