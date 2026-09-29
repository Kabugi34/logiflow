import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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

  if (authService.hasRole('DISTRIBUTOR_ADMIN') ||
      authService.hasRole('DISTRIBUTOR_STAFF')) {
    return true;
  }

  return router.createUrlTree(['/']);
};
