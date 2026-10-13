import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const distributorGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (
    isDevMode() &&
    router.parseUrl(state.url).queryParams['preview'] === 'distributor'
  ) {
    return true;
  }

  return authService.restoreSession().pipe(
    map(user => (user?.roles?.some(role => role === 'DISTRIBUTOR_ADMIN' || role === 'DISTRIBUTOR_STAFF')
      || user?.organization?.type === 'DISTRIBUTOR')
      ? true
      : router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } })),
    catchError(() => of(router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } })))
  );
};
