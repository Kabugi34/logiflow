import { Routes } from '@angular/router';

export const PURCHASE_ORDER_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/purchase-order-list.component').then(module => module.PurchaseOrderListComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/purchase-order-review.component').then(module => module.PurchaseOrderReviewComponent)
  }
];
