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
          destinationWarehouseId: 'distributor-warehouse-1',
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
        {
          id: 'unknown-status-po',
          purchaseOrderNumber: 'MPO-4',
          buyerOrganizationId: 'distributor-1',
          status: 'PROCESSING',
          submittedAt: '2026-10-28T09:00:00Z',
          items: [],
        },
      ],
    });
    httpTesting
      .expectOne(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`)
      .flush({ content: [] });
    const transactionRows = [
      { id: 'pay-paid', orderId: 'paid-po', orderType: 'PURCHASE_ORDER', direction: 'INCOMING', amount: 600000, currency: 'KES', provider: 'MPESA', status: 'SUCCEEDED', createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z' },
      null,
      { id: 'pay-failed', orderId: 'failed-po', orderType: 'PURCHASE_ORDER', direction: 'INCOMING', amount: 125, currency: 'KES', provider: 'MPESA', status: 'FAILED', createdAt: '2026-11-20T09:00:00Z', updatedAt: '2026-11-20T09:00:00Z' },
    ];
    for (let index = 0; index < ['paid-po', 'unknown-po', 'failed-po'].length; index++) {
      const orderId = ['paid-po', 'unknown-po', 'failed-po'][index];
      const request = httpTesting.expectOne(
        (req) => req.url === API_ENDPOINTS.payments.transactions
          && req.params.get('orderType') === 'PURCHASE_ORDER'
          && req.params.get('orderId') === orderId,
      );
      request.flush({ content: transactionRows[index] ? [transactionRows[index]] : [] });
    }
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
      'UNKNOWN',
    ]);
    expect(service.orders()[0]).toMatchObject({
      destinationWarehouseId: 'distributor-warehouse-1',
      destinationHub: 'distributor-warehouse-1',
      paymentDetails: {
        amount: 600000,
        currency: 'KES',
        reference: 'pay-paid',
        mode: 'MPESA',
      },
    });
  });

  it('does not coerce an unrecognized purchase-order state to pending approval', () => {
    expect(service.findById('unknown-status-po')?.status).toBe('UNKNOWN');
  });

  function flushRefresh(orders: unknown[]): void {
    httpTesting.expectOne(API_ENDPOINTS.manufacturer.purchaseOrders).flush({ content: orders });
    httpTesting
      .expectOne(`${API_ENDPOINTS.manufacturer.stockItems}?size=100`)
      .flush({ content: [] });
    for (const row of orders as { id: string; status: string }[]) {
      if (row.status !== 'APPROVED' && row.status !== 'ACCEPTED' && row.status !== 'FULFILLED') {
        continue;
      }
      httpTesting
        .expectOne(
          (request) =>
            request.url === API_ENDPOINTS.payments.transactions &&
            request.params.get('orderType') === 'PURCHASE_ORDER' &&
            request.params.get('orderId') === row.id,
        )
        .flush({ content: [] });
    }
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
    expect(credit.paymentTerms).toBe('PAY_NOW');
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

  it('downloads proof as a blob with the session, not through a public URL', () => {
    service.downloadProof('po-3', 'doc-9').subscribe();

    const request = httpTesting.expectOne(API_ENDPOINTS.manufacturer.purchaseOrderProof('po-3', 'doc-9'));
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['x']));
  });

});