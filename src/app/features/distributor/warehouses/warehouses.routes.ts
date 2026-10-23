import { Routes } from '@angular/router';
export const DISTRIBUTOR_WAREHOUSE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/warehouse-directory.component').then(
        (module) => module.WarehouseDirectoryComponent,
      ),
  },
];
