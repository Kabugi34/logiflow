import { Routes } from '@angular/router';
export const DISTRIBUTOR_VEHICLE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/vehicle-directory.component').then(
        (module) => module.VehicleDirectoryComponent,
      ),
  },
];
