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
});
