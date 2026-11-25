import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../api/api.config';
import { API_ENDPOINTS } from '../api/api-endpoints';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  let requestUrl: URL;
  let apiUrl: URL;
  try {
    requestUrl = new URL(request.url);
    apiUrl = new URL(API_CONFIG.apiRoot);
  } catch {
    return next(request);
  }
  const apiPath = apiUrl.pathname.replace(/\/$/, '');
  const trusted = requestUrl.origin === apiUrl.origin
    && (requestUrl.pathname === apiPath || requestUrl.pathname.startsWith(`${apiPath}/`));
  const authPaths = [API_ENDPOINTS.auth.login, API_ENDPOINTS.auth.refresh, API_ENDPOINTS.auth.logout, API_ENDPOINTS.auth.me]
    .map((url) => new URL(url).pathname);
  const isAuthRequest = authPaths.includes(requestUrl.pathname);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !trusted || isAuthRequest) {
        return throwError(() => error);
      }
      if (!authService.accessToken) {
        if (authService.hasSessionCredentials() || authService.isAuthenticated()) authService.clearUser();
        return throwError(() => error);
      }
      return authService.refreshAccessToken().pipe(
        switchMap(() => {
          const token = authService.accessToken;
          if (!token) return throwError(() => error);
          return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
        }),
        catchError(refreshError => throwError(() => refreshError)),
      );
    }),
  );
};
