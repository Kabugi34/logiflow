import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { CentralizedCheckoutService, CheckoutResponse } from './checkout.service';

describe('CentralizedCheckoutService', () => {
  let service: CentralizedCheckoutService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CentralizedCheckoutService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('creates a multi-supplier checkout with the stable idempotency key and selected warehouses', () => {
    const body = {
      supplierOrders: [
        { supplierOrganizationId: 'supplier-a', destinationWarehouseId: 'warehouse-a', items: [{ stockItemId: 'stock-a', quantity: 3, distributorOfferId: null }] },
        { supplierOrganizationId: 'supplier-b', destinationWarehouseId: 'warehouse-b', items: [{ stockItemId: 'stock-b', quantity: 2, distributorOfferId: null }] },
      ],
    };
    service.create(body, 'stable-checkout-key').subscribe();
    const req = http.expectOne(API_ENDPOINTS.distributor.checkouts);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('stable-checkout-key');
    expect(req.request.body).toEqual(body);
    req.flush({} as CheckoutResponse);
  });

  it('starts one supported demo payment with its stable idempotency key', () => {
    service.initiatePayment('checkout-1', 'DEMO_MPESA', 'stable-payment-key').subscribe();
    const req = http.expectOne(API_ENDPOINTS.distributor.checkoutPayment('checkout-1'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('stable-payment-key');
    expect(req.request.body).toEqual({ method: 'DEMO_MPESA' });
    req.flush({} as CheckoutResponse);
  });
});
