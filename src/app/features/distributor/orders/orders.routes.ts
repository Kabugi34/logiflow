import { Routes } from '@angular/router';

export const ORDER_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/order-list.component').then(module => module.OrderListComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/order-form.component').then(module => module.OrderFormComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/order-details.component').then(module => module.OrderDetailsComponent)
  }
];
