import { Routes } from '@angular/router';
import { WarehouseOperationsService } from '../../warehouse-operations/warehouse-operations.service';
export const DISTRIBUTOR_WAREHOUSE_ROUTES: Routes = [
  {
    path: 'operations',
    providers: [WarehouseOperationsService],
    loadComponent: () =>
      import('./pages/warehouse-operations.component').then(
        (module) => module.WarehouseOperationsComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/warehouse-directory.component').then(
        (module) => module.WarehouseDirectoryComponent,
      ),
  },
];
