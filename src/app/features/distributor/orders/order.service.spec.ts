import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorOrderService } from './order.service';

describe('DistributorOrderService', () => {
  let service: DistributorOrderService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DistributorOrderService);
    httpTesting = TestBed.inject(HttpTestingController);

    httpTesting.expectOne(`${API_ENDPOINTS.distributor.trips}?size=100`).flush({
      content: [
        {
          id: 'trip-1',
          tripNumber: 'TRIP-001',
          type: 'DELIVERY',
          status: 'ONGOING',
          origin: { name: 'Warehouse', address: 'Nairobi', latitude: -1.28, longitude: 36.82 },
          stops: [
            {
              id: 'stop-1',
              sequence: 1,
              location: {
                name: 'Westlands',
                address: 'Nairobi',
                latitude: -1.27,
                longitude: 36.81,
              },
              status: 'PENDING',
              etaLabel: null,
              orderNumber: 'ORD-001',
              contactName: null,
            },
          ],
          itemsOnBoard: [],
          scheduledStartLabel: null,
          totalDistanceKm: 0,
        },
      ],
    });
    httpTesting.expectOne(API_ENDPOINTS.distributor.orders).flush({
      content: [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          customerId: 'customer-1',
          organizationId: 'distributor-1',
          status: 'IN_TRANSIT',
          deliveryAddress: 'Westlands, Nairobi',
          subtotalAmount: 100,
          totalAmount: 100,
          placedAt: '2026-10-28T09:00:00Z',
          paymentStatus: 'PAID',
          items: [],
        },
      ],
    });
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('groups API-backed active outbound orders by trip route', () => {
    const shipments = service.groupOrdersByRoute();

    expect(shipments).toHaveLength(1);
    expect(shipments[0].routeLabel).toBe('Westlands');
    expect(shipments[0].orderIds).toEqual(['order-1']);
    expect(shipments[0].status).toBe('IN_TRANSIT');
  });

  it('keeps failed, expired, reversed, and unknown payments distinct from pending', () => {
    service.recordPaymentStatus('order-1', 'FAILED');
    expect(service.findById('order-1')?.paymentStatus).toBe('FAILED');

    service.recordPaymentStatus('order-1', 'EXPIRED');
    expect(service.findById('order-1')?.paymentStatus).toBe('EXPIRED');

    service.recordPaymentStatus('order-1', 'REVERSED');
    expect(service.findById('order-1')?.paymentStatus).toBe('REVERSED');

    service.recordPaymentStatus('order-1', 'UNRECOGNIZED');
    expect(service.findById('order-1')?.paymentStatus).toBe('UNKNOWN');
  });

  it('blocks fulfillment status transitions until payment is backend-confirmed', () => {
    service.recordPaymentStatus('order-1', 'PENDING');
    let message = '';

    service.updateStatus('order-1', 'PROCESSING').subscribe({
      error: (error: Error) => (message = error.message),
    });

    expect(message).toContain('Backend-confirmed payment');
  });
});
