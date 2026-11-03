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
});
