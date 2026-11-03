import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorCatalogService } from '../catalog/catalog.service';
import { DistributorProcurementService } from './procurement.service';

describe('DistributorProcurementService', () => {
  let service: DistributorProcurementService;
  let httpTesting: HttpTestingController;
  let authorizationStatus: WritableSignal<'NONE' | 'APPROVED'>;

  beforeEach(() => {
    authorizationStatus = signal<'NONE' | 'APPROVED'>('NONE');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: DistributorCatalogService,
          useValue: { authorizationStatus: () => authorizationStatus() },
        },
      ],
    });
    service = TestBed.inject(DistributorProcurementService);
    httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${API_ENDPOINTS.distributor.products}?size=100`).flush({
      content: [
        {
          id: 'product-1',
          sourceStockItemId: 'manufacturer-stock-1',
          organizationId: 'manufacturer-1',
          manufacturerName: 'Manufacturer One',
          sku: 'SKU-001',
          name: 'Product One',
          category: 'Food',
          unitPrice: 100,
          active: true,
          publicationStatus: 'PUBLISHED',
          inStock: true,
        },
      ],
    });
    httpTesting.expectOne(API_ENDPOINTS.distributor.purchaseOrders).flush([]);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('rejects purchase order creation until the manufacturer authorization is approved', () => {
    expect(() => service.createDraft('manufacturer-1', [{ sku: 'SKU-001', quantity: 2 }])).toThrow(
      /authorization is required/i,
    );

    authorizationStatus.set('APPROVED');
    expect(() =>
      service.createDraft('manufacturer-1', [{ sku: 'SKU-001', quantity: 2 }]),
    ).not.toThrow();
  });
});
