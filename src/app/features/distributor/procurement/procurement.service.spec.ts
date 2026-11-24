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
          useValue: { authorizationStatus: () => authorizationStatus() },
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
