import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerPurchaseOrderService } from './purchase-order.service';

describe('ManufacturerPurchaseOrderService', () => {
  let service: ManufacturerPurchaseOrderService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ManufacturerPurchaseOrderService);
    httpTesting = TestBed.inject(HttpTestingController);

    httpTesting.expectOne(API_ENDPOINTS.manufacturer.purchaseOrders).flush({
      content: [
        {
          id: 'paid-po',
          purchaseOrderNumber: 'MPO-1',
          buyerOrganizationId: 'distributor-1',
          status: 'APPROVED',
          paymentStatus: 'SUCCEEDED',
          submittedAt: '2026-10-28T09:00:00Z',
          items: [],
        },
        {
          id: 'unknown-po',
          purchaseOrderNumber: 'MPO-2',
          buyerOrganizationId: 'distributor-1',
          status: 'APPROVED',
          submittedAt: '2026-10-28T09:00:00Z',
          items: [],
        },
        {
          id: 'failed-po',
          purchaseOrderNumber: 'MPO-3',
          buyerOrganizationId: 'distributor-1',
          status: 'APPROVED',
          paymentStatus: 'FAILED',
          submittedAt: '2026-10-28T09:00:00Z',
          items: [],
        },
      ],
    });
    httpTesting
      .expectOne(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`)
      .flush({ content: [] });
    httpTesting
      .expectOne(`${API_ENDPOINTS.payments.transactions}?orderType=PURCHASE_ORDER`)
      .flush({ content: [] });
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('distinguishes verified, failed, and missing supplier payment status', () => {
    expect(service.orders().map((order) => order.paymentStatus)).toEqual([
      'PAID',
      'UNKNOWN',
      'FAILED',
    ]);
  });

  function flushRefresh(orders: unknown[]): void {
    httpTesting.expectOne(API_ENDPOINTS.manufacturer.purchaseOrders).flush({ content: orders });
    httpTesting
      .expectOne(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`)
      .flush({ content: [] });
    httpTesting
      .expectOne(`${API_ENDPOINTS.payments.transactions}?orderType=PURCHASE_ORDER`)
      .flush({ content: [] });
  }

  it('maps credit terms, amounts and settlement payments', () => {
    service.refresh();
    flushRefresh([
      {
        id: 'credit-po',
        purchaseOrderNumber: 'MPO-9',
        buyerOrganizationId: 'distributor-9',
        status: 'APPROVED',
        paymentTerms: 'CREDIT',
        totalAmount: 1000,
        amountPaid: 400,
        amountOutstanding: 600,
        dueAt: '2026-12-24T00:00:00Z',
        overdue: false,
        submittedAt: '2026-11-24T09:00:00Z',
        items: [],
        settlements: [
          {
            id: 's1',
            status: 'PENDING',
            method: 'BANK_TRANSFER',
            totalDue: 1000,
            amountPaid: 400,
            amountOutstanding: 600,
            amount: 1000,
            currency: 'KES',
            note: null,
            settledAt: null,
            payments: [
              {
                id: 'p1',
                method: 'BANK_TRANSFER',
                payerReference: 'REF-1',
                amount: 400,
                status: 'CONFIRMED',
                proofDocumentId: 'doc-1',
                submittedAt: '2026-11-24T10:00:00Z',
                confirmedAt: '2026-11-24T11:00:00Z',
              },
            ],
          },
        ],
      },
      {
        id: 'plain-po',
        purchaseOrderNumber: 'MPO-10',
        buyerOrganizationId: 'distributor-9',
        status: 'APPROVED',
        totalAmount: 250,
        submittedAt: '2026-11-24T09:00:00Z',
        items: [],
      },
    ]);

    const [credit, plain] = service.orders();
    expect(credit.paymentTerms).toBe('CREDIT');
    expect(credit.distributorId).toBe('distributor-9');
    expect(credit.amountPaid).toBe(400);
    expect(credit.amountOutstanding).toBe(600);
    expect(credit.settlements?.[0].payments[0].payerReference).toBe('REF-1');
    // Orders from an older API shape default to pay-now with the whole total outstanding.
    expect(plain.paymentTerms).toBe('PAY_NOW');
    expect(plain.amountOutstanding).toBe(250);
  });

  it('confirms a bank payment with the reference and the amount received', () => {
    let done = false;
    service.confirmBankPayment('po-1', 'REF-1', 400).subscribe(() => (done = true));

    const request = httpTesting.expectOne(API_ENDPOINTS.manufacturer.purchaseOrderConfirmPayment('po-1'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reference: 'REF-1', amountReceived: 400 });
    request.flush({});
    flushRefresh([]);
    expect(done).toBe(true);
  });

  it('cancels an overdue order through the dedicated endpoint', () => {
    service.cancelOverdue('po-2', 'unpaid').subscribe();

    const request = httpTesting.expectOne(API_ENDPOINTS.manufacturer.purchaseOrderCancelOverdue('po-2'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ note: 'unpaid' });
    request.flush({});
    flushRefresh([]);
  });

  it('downloads proof as a blob with the session, not through a public URL', () => {
    service.downloadProof('po-3', 'doc-9').subscribe();

    const request = httpTesting.expectOne(API_ENDPOINTS.manufacturer.purchaseOrderProof('po-3', 'doc-9'));
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['x']));
  });

  it('saves credit terms with the version it was editing', () => {
    service
      .saveCredit('dist-1', { creditLimit: 5000, termDays: 30, status: 'ACTIVE', expectedVersion: 2 })
      .subscribe();

    const request = httpTesting.expectOne(API_ENDPOINTS.manufacturer.distributorCredit('dist-1'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      creditLimit: 5000,
      termDays: 30,
      status: 'ACTIVE',
      expectedVersion: 2,
    });
    request.flush({});
  });
});