import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorCatalogService } from './catalog.service';

describe('DistributorCatalogService', () => {
  let service: DistributorCatalogService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DistributorCatalogService);
    httpTesting = TestBed.inject(HttpTestingController);

    httpTesting.expectOne(`${API_ENDPOINTS.distributor.products}?size=100`).flush({
      content: [
        {
          id: 'product-1',
          organizationId: null,
          manufacturerOrganizationId: 'manufacturer-1',
          sku: 'SKU-001',
          name: 'Product One',
          category: 'Food',
          description: 'A published product description.',
          unitPrice: 250,
          active: true,
          publicationStatus: 'PUBLISHED',
          inStock: true,
          manufacturerName: 'Acme Manufacturing',
          imageUrl: 'https://example.test/product.png',
        },
      ],
    });
    httpTesting
      .expectOne(`${API_ENDPOINTS.distributor.stockItems}?size=100`)
      .flush({ content: [] });
    httpTesting
      .expectOne(`${API_ENDPOINTS.distributor.warehouses}?size=100`)
      .flush({ content: [] });
    httpTesting.expectOne(API_ENDPOINTS.distributor.productAuthorizations).flush([]);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('retains manufacturer description and image in the public catalog view', () => {
    expect(service.availableProducts()).toEqual([
      expect.objectContaining({
        id: 'product-1',
        name: 'Product One',
        description: 'A published product description.',
        wholesalePrice: 250,
        inStock: true,
        manufacturerName: 'Acme Manufacturing',
        imageUrl: 'https://example.test/product.png',
      }),
    ]);
    expect(service.manufacturers()).toEqual([
      { id: 'manufacturer-1', name: 'Acme Manufacturing' },
    ]);
  });

  it('sends listing permission requests with the distributor note', () => {
    service
      .requestAuthorization('product-1', { requestNote: 'Regional retail listing' })
      .subscribe();
    const request = httpTesting.expectOne(
      API_ENDPOINTS.distributor.productAuthorizationRequest('product-1'),
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ requestNote: 'Regional retail listing' });
    request.flush({ id: 'auth-1', productId: 'product-1', status: 'PENDING' });
  });

  it('requires approved authorization to create a stock offer and sends no quantity', () => {
    const draft = {
      sourceStockItemId: 'product-1',
      warehouseId: 'warehouse-1',
      sku: 'SKU-001-D',
      listPrice: 325,
      reorderThreshold: 2,
    };

    expect(() => service.addOffer(draft)).toThrow(/authorization is required/i);

    loadCatalogWithOffer(4, 'APPROVED');
    service.addOffer(draft).subscribe();
    const request = httpTesting.expectOne(API_ENDPOINTS.distributor.stockOffers);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      sourceStockItemId: 'product-1',
      warehouseId: 'warehouse-1',
      sku: 'SKU-001-D',
      sellingPrice: 325,
      reorderThreshold: 2,
    });
    expect(request.request.body).not.toHaveProperty('quantity');
    request.flush({ id: 'offer-1' });
  });

  it('only resumes an approved offer when backend-reported available stock is positive', () => {
    loadCatalogWithOffer(0, 'APPROVED');
    expect(() => service.updateOffer('offer-1', { active: true })).toThrow(/receive available stock/i);

    loadCatalogWithOffer(null, 'APPROVED');
    expect(() => service.updateOffer('offer-1', { active: true })).toThrow(
      /availability could not be confirmed/i,
    );

    loadCatalogWithOffer(3, 'REVOKED');
    expect(() => service.updateOffer('offer-1', { active: true })).toThrow(
      /authorization must be approved/i,
    );

    loadCatalogWithOffer(3, 'APPROVED');
    service.updateOffer('offer-1', { active: true }).subscribe();
    const request = httpTesting.expectOne(API_ENDPOINTS.distributor.stockOffer('offer-1'));
    expect(request.request.body).toEqual({ active: true });
    request.flush({ id: 'offer-1' });
  });

  function loadCatalogWithOffer(
    availableQuantity: number | null,
    authorizationStatus: 'APPROVED' | 'REVOKED',
  ): void {
    service.refresh();
    httpTesting.expectOne(`${API_ENDPOINTS.distributor.products}?size=100`).flush({
      content: [
        {
          id: 'product-1',
          organizationId: 'manufacturer-1',
          sku: 'SKU-001',
          name: 'Product One',
          category: 'Food',
          unitPrice: 250,
          active: true,
          publicationStatus: 'PUBLISHED',
          inStock: true,
        },
      ],
    });
    httpTesting.expectOne(`${API_ENDPOINTS.distributor.stockItems}?size=100`).flush({
      content: [
        {
          id: 'offer-1',
          sourceStockItemId: 'product-1',
          manufacturerOrganizationId: 'manufacturer-1',
          sku: 'SKU-001-D',
          name: 'Product One',
          category: 'Food',
          unitPrice: 325,
          reorderThreshold: 2,
          availableQuantity,
          active: false,
        },
      ],
    });
    httpTesting.expectOne(`${API_ENDPOINTS.distributor.warehouses}?size=100`).flush([]);
    httpTesting.expectOne(API_ENDPOINTS.distributor.productAuthorizations).flush([
      { id: 'auth-1', productId: 'product-1', status: authorizationStatus },
    ]);
  }
});
