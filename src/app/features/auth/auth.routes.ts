import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'request-access',
    loadComponent: () =>
      import('./pages/request-access.component')
        .then(module => module.RequestAccessComponent)
  },
  {
    path: 'activate',
    loadComponent: () =>
      import('./pages/activate-account.component')
        .then(module => module.ActivateAccountComponent)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login.component')
        .then(module => module.LoginComponent)
  }
];
