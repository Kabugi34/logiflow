import { Routes } from '@angular/router';

export const LOGISTICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/distributor-logistics.component').then(
        m => m.DistributorLogisticsComponent
      )
  }
];
