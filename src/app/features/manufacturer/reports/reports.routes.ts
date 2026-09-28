import { Routes } from '@angular/router';

export const REPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/reports-center.component').then(module => module.ReportsCenterComponent)
  }
];
