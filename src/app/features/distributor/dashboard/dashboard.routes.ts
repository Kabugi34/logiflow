import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(
        './pages/distributor-dashboard.component'
      ).then(
        m => m.DistributorDashboardComponent
      )
  }
];
