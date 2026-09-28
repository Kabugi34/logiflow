import { HttpInterceptorFn } from '@angular/common/http';

const ACCESS_TOKEN_KEY = 'logiflow.accessToken';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return next(request);

  return next(request.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};
