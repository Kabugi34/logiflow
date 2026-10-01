import { Routes } from '@angular/router';

import { manufacturerGuard } from './core/guards/manufacturer.guard';
import { distributorGuard } from './core/guards/distributor.guard';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { distributorWorkspace, manufacturerWorkspace } from './layout/navigation/navigation.config';



export const routes: Routes = [
    {
    path: '',
    pathMatch: 'full',
    redirectTo: '/manufacturer/dashboard?preview=manufacturer'
  },

  {
    path: 'manufacturer',
    component: AppShellComponent,
    canActivate: [manufacturerGuard],
    data: { workspace: manufacturerWorkspace },
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
      },
      {
        path: 'logistics',
        loadChildren: () =>
          import('./features/manufacturer/logistics/logistics.routes')
            .then(m => m.LOGISTICS_ROUTES)
      },
      {
        path: 'drivers',
        loadChildren: () =>
          import('./features/manufacturer/drivers/drivers.routes')
            .then(m => m.DRIVER_ROUTES)
      },
      {
        path: 'vehicles',
        loadChildren: () =>
          import('./features/manufacturer/vehicles/vehicles.routes')
            .then(m => m.VEHICLE_ROUTES)
      },
      {
        path: 'staff',
        loadChildren: () =>
          import('./features/manufacturer/staff/staff.routes')
            .then(m => m.STAFF_ROUTES)
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/manufacturer/reports/reports.routes')
            .then(m => m.REPORT_ROUTES)
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./features/manufacturer/settings/settings.routes')
            .then(m => m.SETTINGS_ROUTES)
      }
    ]
  },

  {
    path: 'distributor',
    component: AppShellComponent,
    canActivate: [distributorGuard],
    data: { workspace: distributorWorkspace },
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/distributor/dashboard/dashboard.routes')
            .then(m => m.DASHBOARD_ROUTES)
      },
      {
        path: 'catalog',
        loadChildren: () =>
          import('./features/distributor/catalog/catalog.routes')
            .then(m => m.CATALOG_ROUTES)
      },
      {
        path: 'orders',
        loadChildren: () =>
          import('./features/distributor/orders/orders.routes')
            .then(m => m.ORDER_ROUTES)
      },
      {
        path: '**',
        redirectTo: 'dashboard'
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'manufacturer/dashboard'
  }
];
