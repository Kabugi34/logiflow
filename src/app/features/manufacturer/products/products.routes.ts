import { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/product-list.component').then(module => module.ProductListComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/product-form.component').then(module => module.ProductFormComponent)
  },
  {
    path: ':sku',
    loadComponent: () => import('./pages/product-details.component').then(module => module.ProductDetailsComponent)
  }
];
