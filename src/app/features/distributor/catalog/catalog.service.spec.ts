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
          availableQuantity: 12,
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
        availableQuantity: 12,
        manufacturerName: 'Acme Manufacturing',
        imageUrl: 'https://example.test/product.png',
      }),
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
});
