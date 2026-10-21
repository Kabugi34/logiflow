import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../api/api.config';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).accessToken;

  let requestUrl: URL;
  let apiUrl: URL;
  try {
    requestUrl = new URL(request.url);
    apiUrl = new URL(API_CONFIG.apiRoot);
  } catch {
    return next(request);
  }

  const apiPath = apiUrl.pathname.replace(/\/$/, '');
  const isTrustedApiRequest = requestUrl.origin === apiUrl.origin
    && (requestUrl.pathname === apiPath || requestUrl.pathname.startsWith(`${apiPath}/`));
  if (!isTrustedApiRequest) return next(request);

  // ngrok's free-tier browser interstitial can return HTML for API calls.
  // Add its bypass header only for ngrok hosts, including unauthenticated
  // requests such as login. The backend CORS policy must allow this header.
  const isNgrokHost = requestUrl.hostname.endsWith('.ngrok-free.app')
    || requestUrl.hostname.endsWith('.ngrok.app')
    || requestUrl.hostname.endsWith('.ngrok.io');
  if (isNgrokHost) {
    request = request.clone({ setHeaders: { 'ngrok-skip-browser-warning': 'true' } });
  }

  // Refresh uses its refresh-token body to renew an expired access token.
  // Sending that expired bearer token as well can cause some backends to
  // reject the refresh request before they inspect the refresh token.
  const refreshPath = `${apiPath}${API_CONFIG.auth.refresh}`;
  if (requestUrl.pathname === refreshPath) return next(request);

  return token
    ? next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    : next(request);
};
