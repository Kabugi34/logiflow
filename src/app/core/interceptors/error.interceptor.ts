import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../api/api.config';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const sessionLookupUrl = `${API_CONFIG.apiRoot}${API_CONFIG.auth.me}`;

  return next(request).pipe(
    catchError((error: unknown) => {
      // AuthApiService sends /users/me through apiRoot. Use the same root here
      // so a 401 can reach AuthService.restoreSession(), which owns refresh.
      const isSessionLookup = request.url === sessionLookupUrl;
      if (error instanceof HttpErrorResponse && error.status === 401 && !isSessionLookup) {
        authService.clearUser();
      }
      return throwError(() => error);
    })
  );
};
