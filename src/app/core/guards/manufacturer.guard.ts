import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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

  if (authService.hasRole('MANUFACTURER_ADMIN') ||
      authService.hasRole('MANUFACTURER_STAFF')) {
    return true;
  }

  return router.createUrlTree(['/']);
};