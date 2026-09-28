import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const distributorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasRole('DISTRIBUTOR_ADMIN') ||
      authService.hasRole('DISTRIBUTOR_STAFF')) {
    return true;
  }

  return router.createUrlTree(['/']);
};