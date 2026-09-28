import { Routes } from '@angular/router';

export const WAREHOUSE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/warehouse-overview.component').then(module => module.WarehouseOverviewComponent)
  }
];
