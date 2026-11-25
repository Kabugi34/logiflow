import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorCatalogService } from '../catalog/catalog.service';
import { DistributorProcurementService } from './procurement.service';

describe('DistributorProcurementService', () => {
  let service: DistributorProcurementService;
  let httpTesting: HttpTestingController;
  let authorizationStatus: WritableSignal<'NONE' | 'APPROVED'>;

  beforeEach(() => {
    authorizationStatus = signal<'NONE' | 'APPROVED'>('NONE');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: DistributorCatalogService,
          useValue: { authorizationStatus: () => authorizationStatus(), manufacturers: () => [] },
        },
      ],
    });
    service = TestBed.inject(DistributorProcurementService);
    httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${API_ENDPOINTS.distributor.products}?size=100`).flush({
      content: [
        {
          id: 'product-1',
          sourceStockItemId: 'manufacturer-stock-1',
          organizationId: 'manufacturer-1',
          manufacturerName: 'Manufacturer One',
          sku: 'SKU-001',
          name: 'Product One',
          category: 'Food',
          unitPrice: 100,
          active: true,
          publicationStatus: 'PUBLISHED',
          inStock: true,
        },
      ],
    });
    httpTesting.expectOne(API_ENDPOINTS.distributor.purchaseOrders).flush([]);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('rejects purchase order creation until the manufacturer authorization is approved', () => {
    expect(() => service.createDraft('manufacturer-1', [{ sku: 'SKU-001', quantity: 2 }])).toThrow(
      /authorization is required/i,
    );

    authorizationStatus.set('APPROVED');
    expect(service.productsForManufacturer('manufacturer-1')[0].inStock).toBe(true);
    expect(() =>
      service.createDraft('manufacturer-1', [{ sku: 'SKU-001', quantity: 2 }]),
    ).not.toThrow();
  });

  it('submits a bank transfer as multipart with the idempotency key and does not mark the order paid', () => {
    const proof = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'slip.pdf', {
      type: 'application/pdf',
    });
    service.submitBankTransfer('po-1', '  ref-123 ', proof, 'key-1').subscribe();

    const request = httpTesting.expectOne(API_ENDPOINTS.distributor.purchaseOrderBankTransfer('po-1'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    const body = request.request.body as FormData;
    expect(body.get('reference')).toBe('ref-123');
    expect((body.get('file') as File).name).toBe('slip.pdf');
    request.flush({
      id: 'po-1',
      purchaseOrderNumber: 'PO-1',
      status: 'APPROVED',
      paymentStatus: 'PENDING',
      paymentTerms: 'PAY_NOW',
      totalAmount: 200,
      amountPaid: 0,
      amountOutstanding: 200,
      items: [],
    });
  });

  it('sends the chosen payment terms when creating a purchase order', () => {
    authorizationStatus.set('APPROVED');
    service.createDraft('manufacturer-1', [{ sku: 'SKU-001', quantity: 2 }], 'CREDIT').subscribe();

    const request = httpTesting.expectOne(API_ENDPOINTS.distributor.purchaseOrders);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.paymentTerms).toBe('CREDIT');
    request.flush({ id: 'po-new', purchaseOrderNumber: 'PO-N', status: 'SUBMITTED', totalAmount: 200, items: [] });
    // Creating an order reloads the list.
    httpTesting.expectOne(API_ENDPOINTS.distributor.purchaseOrders).flush([]);
  });

  it('allows published products into centralized checkout without legacy authorization approval', () => {
    expect(authorizationStatus()).toBe('NONE');
    expect(service.checkoutProducts().map((product) => product.productId)).toEqual(['product-1']);
  });

  it('updates a purchase to paid from backend-confirmed per-order payment history', () => {
    service.refreshOrders();
    httpTesting.expectOne(API_ENDPOINTS.distributor.purchaseOrders).flush({
      content: [{
        id: 'po-paid', purchaseOrderNumber: 'PO-PAID', buyerOrganizationId: 'buyer-1',
        supplierOrganizationId: 'manufacturer-1', status: 'APPROVED', totalAmount: 600000,
        submittedAt: '2026-11-20T10:00:00Z', items: [],
      }],
    });

    httpTesting.expectOne((request) => request.url === API_ENDPOINTS.payments.transactions
      && request.params.get('orderType') === 'PURCHASE_ORDER'
      && request.params.get('orderId') === 'po-paid').flush({
        content: [{
          id: 'payment-1', orderId: 'po-paid', orderType: 'PURCHASE_ORDER',
          direction: 'OUTGOING', amount: 600000, currency: 'KES', provider: 'MPESA',
          status: 'SUCCEEDED', createdAt: '2026-11-20T10:01:00Z', updatedAt: '2026-11-20T10:02:00Z',
        }],
      });

    expect(service.findOrder('po-paid')?.paymentStatus).toBe('PAID');
  });
});
