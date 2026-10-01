import { Routes } from '@angular/router';

export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/master-catalog.component')
        .then(module => module.MasterCatalogComponent)
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/catalog-offer-form.component')
        .then(module => module.CatalogOfferFormComponent)
  }
];
