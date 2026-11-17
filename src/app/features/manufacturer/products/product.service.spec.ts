import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerProductService } from './product.service';

describe('ManufacturerProductService', () => {
  let service: ManufacturerProductService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ManufacturerProductService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify({ ignoreCancelled: true });
    TestBed.resetTestingModule();
  });

  it('keeps the last usable product data when a refresh fails', () => {
    httpTesting.expectOne(`${API_ENDPOINTS.manufacturer.products}?size=100`).flush({
      content: [
        {
          id: 'product-1',
          sku: 'SKU-001',
          name: 'Product One',
          category: null,
          publicationStatus: 'PUBLISHED',
        },
      ],
    });
    httpTesting
      .expectOne(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`)
      .flush({ content: [] });

    expect(service.products()).toHaveLength(1);
    service.refresh();

    httpTesting
      .expectOne(`${API_ENDPOINTS.manufacturer.products}?size=100`)
      .flush({ message: 'Unavailable' }, { status: 500, statusText: 'Server Error' });

    expect(service.products()).toHaveLength(1);
    expect(service.error()).toBe('Products could not be loaded from the API.');
    expect(service.loading()).toBe(false);
  });

  it('maps current stock and reorder threshold for the product editor', () => {
    httpTesting.expectOne(`${API_ENDPOINTS.manufacturer.products}?size=100`).flush({
      content: [
        {
          id: 'product-2',
          sku: 'SKU-002',
          name: 'Product Two',
          category: 'Motors',
          unitPrice: 125,
          imageUrl: '/uploads/product-two.jpg',
          publicationStatus: 'PUBLISHED',
        },
      ],
    });
    httpTesting.expectOne(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`).flush({
      content: [
        {
          id: 'stock-2',
          productId: 'product-2',
          sku: 'SKU-002',
          name: 'Product Two',
          category: 'Motors',
          unitPrice: 125,
          quantityOnHand: 18,
          reorderThreshold: 5,
          active: true,
        },
        {
          id: 'stock-3',
          productId: 'product-2',
          sku: 'SKU-002',
          name: 'Product Two',
          category: 'Motors',
          unitPrice: 125,
          quantityOnHand: 7,
          reorderThreshold: 3,
          active: true,
        },
      ],
    });

    expect(service.findBySku('SKU-002')?.unitPrice).toBe(125);
    expect(service.findBySku('SKU-002')?.image).toBe('https://distro-backend-09e7.onrender.com/uploads/product-two.jpg');
    expect(service.findBySku('SKU-002')?.stock).toBe(25);
    expect(service.findBySku('SKU-002')?.reorderThreshold).toBe(8);
  });

  it('updates catalog fields without submitting stock values', () => {
    httpTesting.expectOne(`${API_ENDPOINTS.manufacturer.products}?size=100`).flush({ content: [] });
    httpTesting.expectOne(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`).flush({ content: [] });

    let updated = false;
    service
      .update('product-1', {
        name: 'Updated Product',
        category: 'Motors',
        sku: 'SKU-001',
        brand: 'Logiflow',
        unit: 'Pcs',
        description: 'Updated description',
        unitPrice: 42,
      })
      .subscribe(() => (updated = true));

    const request = httpTesting.expectOne(API_ENDPOINTS.manufacturer.product('product-1'));
    expect(request.request.method).toBe('PATCH');
    const body = request.request.body as FormData;
    expect(body.get('name')).toBe('Updated Product');
    expect(body.get('unitPrice')).toBe('42');
    expect(body.get('initialQuantity')).toBeNull();
    expect(body.get('reorderThreshold')).toBeNull();
    request.flush({ id: 'product-1', sku: 'SKU-001', name: 'Updated Product' });

    expect(updated).toBe(true);
  });
});
