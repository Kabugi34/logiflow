import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_ENDPOINTS } from '../api/api-endpoints';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const sessionLookupUrl = API_ENDPOINTS.auth.me;

  return next(request).pipe(
    catchError((error: unknown) => {
      // Let AuthService.restoreSession() handle a session lookup 401 and refresh.
      const isSessionLookup = request.url === sessionLookupUrl;
      if (error instanceof HttpErrorResponse && error.status === 401 && !isSessionLookup) {
        authService.clearUser();
      }
      return throwError(() => error);
    })
  );
};
