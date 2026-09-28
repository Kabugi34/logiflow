import { Routes } from '@angular/router';

import { manufacturerGuard } from './core/guards/manufacturer.guard';
import { distributorGuard } from './core/guards/distributor.guard';
import { AppShellComponent } from './layout/app-shell/app-shell.component';



export const routes: Routes = [
    {
    path: '',
    pathMatch: 'full',
    redirectTo: 'manufacturer/dashboard?preview=manufacturer'
  },

  {
    path: 'manufacturer',
    component: AppShellComponent,
    canActivate: [manufacturerGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/manufacturer/dashboard/dashboard.routes')
            .then(m => m.DASHBOARD_ROUTES)
      },
      {
        path: 'products',
        loadChildren: () =>
          import('./features/manufacturer/products/products.routes')
            .then(m => m.PRODUCTS_ROUTES)
      },
      {
        path: 'inventory',
        loadChildren: () =>
          import('./features/manufacturer/inventory/inventory.routes')
            .then(m => m.INVENTORY_ROUTES)
      },
      {
        path: 'purchase-orders',
        loadChildren: () =>
          import('./features/manufacturer/purchase-orders/purchase-orders.routes')
            .then(m => m.PURCHASE_ORDER_ROUTES)
      },
      {
        path: 'warehouses',
        loadChildren: () =>
          import('./features/manufacturer/warehouses/warehouse.routes')
            .then(m => m.WAREHOUSE_ROUTES)
      },
      {
        path: 'shipments',
        loadChildren: () =>
          import('./features/manufacturer/shipments/shipment.routes')
            .then(m => m.SHIPMENT_ROUTES)
      }
    ]
  },

  {
    path: 'distributor',
    canActivate: [distributorGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import(
            './features/distributor/dashboard/pages/distributor-dashboard/distributor-dashboard.component'
          ).then(m => m.DistributorDashboardComponent)
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'manufacturer/dashboard'
  }
];
