import { Routes } from '@angular/router';

export const LOGISTICS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/logistics-overview.component').then(module => module.LogisticsOverviewComponent)
  },
  {
    path: 'trips',
    pathMatch: 'full',
    loadComponent: () => import('./pages/logistics-overview.component').then(module => module.LogisticsOverviewComponent)
  },
  {
    path: 'live-map',
    loadComponent: () => import('./pages/live-map.component').then(module => module.LiveMapComponent)
  },
  {
    path: 'trips/:id',
    loadComponent: () => import('./pages/trip-details.component').then(module => module.TripDetailsComponent)
  }
];
