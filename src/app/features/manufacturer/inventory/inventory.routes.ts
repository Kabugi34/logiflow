import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/inventory-center.component').then(module => module.InventoryCenterComponent)
  }
];
