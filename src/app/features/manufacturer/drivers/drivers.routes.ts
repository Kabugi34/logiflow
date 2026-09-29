import { Routes } from '@angular/router';

export const DRIVER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/driver-directory.component').then(module => module.DriverDirectoryComponent)
  }
];
