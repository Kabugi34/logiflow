import { Routes } from '@angular/router';

export const CUSTOMER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/customer-directory.component').then(
        m => m.CustomerDirectoryComponent
      )
  }
];
