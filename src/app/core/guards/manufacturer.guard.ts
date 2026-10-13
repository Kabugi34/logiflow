import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const manufacturerGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (
    isDevMode() &&
    router.parseUrl(state.url).queryParams['preview'] === 'manufacturer'
  ) {
    return true;
  }

  return authService.restoreSession().pipe(
    map(user => (user?.roles?.some(role => role === 'MANUFACTURER_ADMIN' || role === 'MANUFACTURER_STAFF')
      || user?.organization?.type === 'MANUFACTURER')
      ? true
      : router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } })),
    catchError(() => of(router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } })))
  );
};
