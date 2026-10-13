import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const manufacturerGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.restoreSession().pipe(
    map(user => (user?.organization.type === 'MANUFACTURER'
      && user.roles.some(role => role === 'MANUFACTURER_ADMIN' || role === 'MANUFACTURER_STAFF'))
      ? true
      : router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } })),
    catchError(() => of(router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } })))
  );
};
