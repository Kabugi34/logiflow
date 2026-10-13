import { Routes } from '@angular/router';

export const PROCUREMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/procurement-center.component').then(module => module.ProcurementCenterComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/purchase-order-form.component').then(module => module.PurchaseOrderFormComponent)
  },
  {
    path: 'manufacturers',
    loadComponent: () => import('./pages/manufacturers-network.component').then(module => module.ManufacturersNetworkComponent)
  },
  {
    path: 'manufacturers/:manufacturerId/catalog',
    loadComponent: () => import('./pages/manufacturer-catalog.component').then(module => module.ManufacturerCatalogComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/purchase-order-details.component').then(module => module.PurchaseOrderDetailsComponent)
  }
];