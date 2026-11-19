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

  it('creates a single-supplier checkout through the same centralized endpoint', () => {
    const body = { supplierOrders: [{ supplierOrganizationId: 'supplier-a', destinationWarehouseId: 'warehouse-a', items: [{ stockItemId: 'stock-a', quantity: 1, distributorOfferId: null }] }] };
    service.create(body, 'single-supplier-key').subscribe();
    const req = http.expectOne(API_ENDPOINTS.distributor.checkouts);
    expect(req.request.body).toEqual(body);
    req.flush({} as CheckoutResponse);
  });

  it('sends the exact M-Pesa sandbox method and phone number', () => {
    service.initiatePayment('checkout-1', 'MPESA_SANDBOX', 'stable-mpesa-key', '+254712345678').subscribe();
    const req = http.expectOne(API_ENDPOINTS.distributor.checkoutPayment('checkout-1'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('stable-mpesa-key');
    expect(req.request.body).toEqual({ method: 'MPESA_SANDBOX', phoneNumber: '254712345678' });
    req.flush({ id: 'checkout-1', status: 'PAYMENT_PENDING', payment: { id: 'payment-1', method: 'MPESA_SANDBOX', status: 'PENDING', demo: true, demoLabel: 'Sandbox', paymentReference: 'MPESA-REF-1' } } as CheckoutResponse);
  });

  it('sends exactly DEMO for demo checkout and accepts a large server-calculated total', () => {
    service.initiatePayment('checkout-1', 'DEMO', 'stable-demo-key').subscribe((result) => {
      expect(result.totalAmount).toBe(9_999_999_999);
      expect(result.payment?.paymentReference).toBe('DEMO-REF-1');
    });
    const req = http.expectOne(API_ENDPOINTS.distributor.checkoutPayment('checkout-1'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('stable-demo-key');
    expect(req.request.body).toEqual({ method: 'DEMO' });
    req.flush({
      id: 'checkout-1', status: 'PAYMENT_PENDING', totalAmount: 9_999_999_999,
      payment: { id: 'payment-1', method: 'DEMO', status: 'SUCCESS', demo: true, demoLabel: 'DEMO — NO MONEY TRANSFERRED', paymentReference: 'DEMO-REF-1' },
    } as CheckoutResponse);
  });

  it('reads backend-confirmed failed payment states without marking the checkout paid', () => {
    service.get('checkout-1').subscribe((result) => {
      expect(result.status).toBe('PAYMENT_FAILED');
      expect(result.payment?.status).toBe('FAILED');
    });
    http.expectOne(API_ENDPOINTS.distributor.checkout('checkout-1')).flush({
      id: 'checkout-1', status: 'PAYMENT_FAILED', payment: { id: 'payment-1', method: 'DEMO', status: 'FAILED', demo: true, demoLabel: 'DEMO', failureReason: 'Rejected' },
    } as CheckoutResponse);
  });
});
