import { Routes } from '@angular/router';

export const VEHICLE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/vehicle-center.component').then(module => module.VehicleCenterComponent)
  }
];
