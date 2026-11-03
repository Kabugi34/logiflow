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
});
