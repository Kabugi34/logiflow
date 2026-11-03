import { Routes } from '@angular/router';
import { WarehouseOperationsService } from '../../warehouse-operations/warehouse-operations.service';

export const WAREHOUSE_ROUTES: Routes = [
  {
    path: 'operations',
    providers: [WarehouseOperationsService],
    loadComponent: () =>
      import('./pages/warehouse-operations.component').then(
        (module) => module.ManufacturerWarehouseOperationsComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/warehouse-overview.component').then(
        (module) => module.WarehouseOverviewComponent,
      ),
  },
];
