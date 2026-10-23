import { Routes } from '@angular/router';
export const DISTRIBUTOR_STAFF_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/staff-directory.component').then((module) => module.StaffDirectoryComponent),
  },
];
