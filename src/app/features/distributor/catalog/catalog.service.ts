import { Injectable, signal } from '@angular/core';
import { DistributorCatalogOffer, DistributorCatalogProduct } from './catalog.models';

@Injectable({ providedIn: 'root' })
export class DistributorCatalogService {
  // There is no distributor offer/catalog-management endpoint in the current backend API.
  readonly offers = signal<DistributorCatalogOffer[]>([]).asReadonly();
  readonly availableProducts = signal<DistributorCatalogProduct[]>([]).asReadonly();

  addOffer(_draft: unknown): never {
    throw new Error('Catalog offers cannot be saved because the backend has no offer-management endpoint yet.');
  }
}
