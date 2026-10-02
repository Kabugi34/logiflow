import { computed, inject, Injectable, signal } from '@angular/core';
import { ManufacturerProductService } from '../../manufacturer/products/product.service';
import { DistributorCatalogOffer, DistributorCatalogProduct } from './catalog.models';

@Injectable({ providedIn: 'root' })
export class DistributorCatalogService {
  private readonly manufacturerProductService = inject(ManufacturerProductService);
  private readonly offerRecords = signal<DistributorCatalogOffer[]>([
    {
      id: 'OFF-1001',
      manufacturerId: 'MFG-LOGICORE',
      manufacturerName: 'LogiCore',
      sku: 'HDM-092-X',
      productName: 'Heavy Duty Hydraulic Motor',
      category: 'Motors',
      brand: 'LogiCore',
      unit: 'Pcs',
      listPrice: 97500,
      minimumOrderQty: 2,
      status: 'ACTIVE',
      addedAt: '2026-09-25',
      notes: 'Preferred contract pricing'
    },
    {
      id: 'OFF-1002',
      manufacturerId: 'MFG-AERODYN',
      manufacturerName: 'AeroDyn',
      sku: 'HPG-881-A',
      productName: 'High-Precision Gear Box',
      category: 'Transmission',
      brand: 'AeroDyn',
      unit: 'Pcs',
      listPrice: 84500,
      minimumOrderQty: 3,
      status: 'ACTIVE',
      addedAt: '2026-09-28',
      notes: 'Fast fulfillment partner'
    }
  ]);

  readonly offers = this.offerRecords.asReadonly();

  readonly availableProducts = computed<DistributorCatalogProduct[]>(() =>
    this.manufacturerProductService.products()
      .filter(product => !this.offerRecords().some(offer => offer.sku === product.sku))
      .map(product => ({
        sku: product.sku,
        name: product.name,
        manufacturerName: product.brand,
        category: product.category,
        brand: product.brand,
        unit: product.unit,
        stock: product.stock,
        description: product.description
      }))
  );

  addOffer(draft: {
    sku: string;
    productName: string;
    manufacturerName: string;
    manufacturerId: string;
    category: string;
    brand: string;
    unit: string;
    listPrice: number;
    minimumOrderQty: number;
    notes: string;
  }): string {
    if (this.offerRecords().some(offer => offer.sku === draft.sku)) {
      throw new Error('This product is already in your catalog.');
    }

    if (draft.listPrice <= 0) {
      throw new Error('Enter a valid listing price.');
    }

    const nextId = `OFF-${Math.max(0, ...this.offerRecords().map(offer => Number(offer.id.replace('OFF-', '')))) + 1}`;

    this.offerRecords.update(offers => [{
      id: nextId,
      manufacturerId: draft.manufacturerId,
      manufacturerName: draft.manufacturerName,
      sku: draft.sku,
      productName: draft.productName,
      category: draft.category,
      brand: draft.brand,
      unit: draft.unit,
      listPrice: draft.listPrice,
      minimumOrderQty: draft.minimumOrderQty,
      status: 'ACTIVE',
      addedAt: new Date().toISOString().slice(0, 10),
      notes: draft.notes
    }, ...offers]);

    return nextId;
  }
}
