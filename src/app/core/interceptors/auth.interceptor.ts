import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../api/api.config';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).accessToken;
  if (!token) return next(request);

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

  return next(request.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};
