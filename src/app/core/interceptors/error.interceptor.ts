import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../api/api.config';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);

  return next(request).pipe(
    catchError((error: unknown) => {
      const isSessionLookup = request.url === `${API_CONFIG.baseUrl}${API_CONFIG.auth.me}`;
      if (error instanceof HttpErrorResponse && error.status === 401 && !isSessionLookup) {
        authService.clearUser();
      }
      return throwError(() => error);
    })
  );
};
