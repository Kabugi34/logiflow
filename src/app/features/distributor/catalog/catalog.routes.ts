import { Routes } from '@angular/router';

export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/master-catalog.component').then((module) => module.MasterCatalogComponent),
  },
  {
    path: 'my',
    loadComponent: () =>
      import('./pages/my-catalogue.component').then((module) => module.MyCatalogueComponent),
  },
  {
    path: 'my/new',
    loadComponent: () =>
      import('./pages/reseller-listing-create.component').then((module) => module.ResellerListingCreateComponent),
  },
  {
    path: 'my/:id',
    loadComponent: () =>
      import('./pages/reseller-listing-detail.component').then((module) => module.ResellerListingDetailComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/catalog-offer-form.component').then(
        (module) => module.CatalogOfferFormComponent,
      ),
  },
];
