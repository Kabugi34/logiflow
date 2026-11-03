import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('deduplicates concurrent requests and never treats initiation as payment confirmation', () => {
    const request = {
      orderId: 'po-42',
      orderType: 'PURCHASE_ORDER' as const,
      provider: 'MPESA' as const,
      phoneNumber: '+254712345678',
    };
    const results: unknown[] = [];
    service.initiate(request).subscribe((result) => results.push(result));
    service.initiate(request).subscribe((result) => results.push(result));

    const req = http.expectOne(API_ENDPOINTS.payments.initiate);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
    req.flush({
      paymentId: 'payment-42',
      paymentReference: 'MPESA-REQ-42',
      provider: 'MPESA',
      status: 'SUCCEEDED',
    });

    expect(results).toEqual([
      {
        paymentId: 'payment-42',
        paymentReference: 'MPESA-REQ-42',
        provider: 'MPESA',
        customerMessage: null,
      },
      {
        paymentId: 'payment-42',
        paymentReference: 'MPESA-REQ-42',
        provider: 'MPESA',
        customerMessage: null,
      },
    ]);

    let duplicateError = '';
    service
      .initiate(request)
      .subscribe({ error: (error: Error) => (duplicateError = error.message) });
    expect(duplicateError).toContain('pending');
  });

  it('verifies customer order status from the existing server status endpoint', () => {
    let verifiedStatus = '';
    service.verifyOrderPayment('CUSTOMER_ORDER', 'order-7').subscribe((result) => {
      verifiedStatus = result.status;
      expect(result.paymentExists).toBe(true);
    });

    http.expectOne(API_ENDPOINTS.distributor.paymentStatus('order-7')).flush({
      orderId: 'order-7',
      paymentId: 'payment-7',
      status: 'SUCCEEDED',
      amount: 125,
      mpesaReceiptNumber: 'RCP-7',
      failureReason: null,
    });

    expect(verifiedStatus).toBe('PAID');
  });

  it('allows a new attempt only after the backend verifies the previous attempt failed', () => {
    const request = {
      orderId: 'po-retry',
      orderType: 'PURCHASE_ORDER' as const,
      provider: 'MPESA' as const,
      phoneNumber: '+254712345678',
    };
    service.initiate(request).subscribe();
    http.expectOne(API_ENDPOINTS.payments.initiate).flush({ paymentId: 'payment-first' });

    let status = '';
    service.verifyOrderPayment('PURCHASE_ORDER', 'po-retry').subscribe((result) => {
      status = result.status;
    });
    http
      .expectOne(
        (request) =>
          request.url === API_ENDPOINTS.payments.transactions &&
          request.params.get('orderType') === 'PURCHASE_ORDER' &&
          request.params.get('orderId') === 'po-retry',
      )
      .flush({
        content: [
          {
            id: 'payment-first',
            orderId: 'po-retry',
            orderType: 'PURCHASE_ORDER',
            direction: 'OUTGOING',
            amount: 125,
            currency: 'KES',
            provider: 'MPESA',
            status: 'FAILED',
            createdAt: '2026-10-28T09:00:00Z',
            updatedAt: '2026-10-28T09:01:00Z',
          },
        ],
      });

    expect(status).toBe('FAILED');
    service.initiate(request).subscribe();
    http.expectOne(API_ENDPOINTS.payments.initiate).flush({ paymentId: 'payment-second' });
  });

  it('loads supplier payment history without trusting local or initiation state', () => {
    service.refreshTransactions('PURCHASE_ORDER');

    http
      .expectOne(
        (request) =>
          request.url === API_ENDPOINTS.payments.transactions &&
          request.params.get('orderType') === 'PURCHASE_ORDER',
      )
      .flush({
        content: [
          {
            id: 'payment-1',
            paymentReference: 'MPESA-1',
            orderId: 'po-1',
            orderReference: 'PO-1',
            orderType: 'PURCHASE_ORDER',
            direction: 'INCOMING',
            counterpartyName: 'Distributor',
            amount: 300,
            currency: 'KES',
            provider: 'MPESA',
            status: 'REFUNDED',
            createdAt: '2026-10-28T09:00:00Z',
            updatedAt: '2026-10-28T10:00:00Z',
            reconciliationStatus: 'RECONCILED',
          },
        ],
      });

    expect(service.transactions()[0]).toMatchObject({
      paymentReference: 'MPESA-1',
      orderReference: 'PO-1',
      amount: 300,
      status: 'REFUNDED',
      reconciliationStatus: 'RECONCILED',
    });
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });
});
