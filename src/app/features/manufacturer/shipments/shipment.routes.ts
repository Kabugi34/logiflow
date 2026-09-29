import { Routes } from '@angular/router';

export const SHIPMENT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/shipment-list.component').then(module => module.ShipmentListComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/shipment-audit.component').then(module => module.ShipmentAuditComponent)
  }
];
