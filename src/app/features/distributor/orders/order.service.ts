import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorTripService } from '../logistics/trip.service';
import {
  CustomerOrder,
  CustomerOrderLine,
  DistributorShipmentGroup,
  NewCustomerOrder,
  PaymentStatus,
} from './order.models';
interface ApiOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  organizationId: string;
  status: string;
  deliveryAddress: string;
  subtotalAmount: number;
  totalAmount: number;
  placedAt: string;
  paymentStatus?: string;
  items?: { stockItemId: string; quantity: number; unitPrice: number }[];
}
interface ApiPage<T> {
  content?: T[];
}
interface ApiStockItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
}
interface PaymentInitiateResponse {
  paymentId: string;
  status: string;
  customerMessage: string;
}
interface PaymentStatusResponse {
  orderId: string;
  paymentId: string | null;
  status: string;
  amount: number;
  mpesaReceiptNumber: string | null;
  failureReason: string | null;
}
@Injectable({ providedIn: 'root' })
export class DistributorOrderService {
  private readonly http = inject(HttpClient);
  private readonly tripService = inject(DistributorTripService);
  private readonly orderRecords = signal<CustomerOrder[]>([]);
  private readonly paymentStatuses = signal<Record<string, PaymentStatus>>({});
  readonly orders = this.orderRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly activeOrders = computed(() =>
    this.orderRecords().filter(
      (order) =>
        !['COMPLETED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED'].includes(order.status),
    ),
  );
  readonly groupedShipments = computed<DistributorShipmentGroup[]>(() => this.groupOrdersByRoute());
  groupOrdersByRoute(): DistributorShipmentGroup[] {
    return this.tripService
      .trips()
      .filter((trip) => trip.type === 'DELIVERY')
      .map((trip) => {
        const orderNumbers = new Set(
          trip.stops.map((stop) => stop.orderNumber).filter((value): value is string => !!value),
        );
        const orders = this.orderRecords().filter(
          (order) => !!order.orderNumber && orderNumbers.has(order.orderNumber),
        );
        const route = [trip.origin, ...trip.stops.map((stop) => stop.location)].map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
          label: point.name,
        }));
        const latest = (this.tripService.tracking()[trip.id] ?? []).at(-1);
        if (latest)
          route.push({ latitude: latest.lat, longitude: latest.lng, label: 'Live location' });
        const status: CustomerOrder['status'] =
          trip.status === 'ONGOING'
            ? 'IN_TRANSIT'
            : trip.status === 'COMPLETED'
              ? 'COMPLETED'
              : trip.status === 'DELAYED'
                ? 'REROUTED'
                : trip.status === 'CANCELLED'
                  ? 'CANCELLED'
                  : 'PREPARING';
        return {
          id: trip.id,
          routeKey: trip.tripNumber,
          routeLabel: trip.stops.at(-1)?.location.name ?? trip.tripNumber,
          status,
          orderIds: orders.map((order) => order.id),
          orders,
          totalValue: orders.reduce((sum, order) => sum + this.total(order), 0),
          route,
          currentRouteIndex: Math.max(0, route.length - 1),
        };
      });
  }
  findShipmentForOrder(orderId: string): DistributorShipmentGroup | undefined {
    return this.groupOrdersByRoute().find((group) => group.orderIds.includes(orderId));
  }
  constructor() {
    this.refresh();
  }
  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<ApiOrder> | ApiOrder[]>(API_ENDPOINTS.distributor.orders).subscribe({
      next: (result) => {
        const rows = Array.isArray(result) ? result : (result.content ?? []);
        this.orderRecords.set(rows.map((row) => this.toOrder(row)));
        this.enrichOrderProducts(rows);
        this.error.set('');
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Orders could not be loaded from the API.');
        this.loading.set(false);
      },
    });
  }
  findById(id: string): CustomerOrder | undefined {
    return this.orderRecords().find((order) => order.id === id);
  }
  total(order: { lines: CustomerOrderLine[] }): number {
    return order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  }
  itemSummary(order: CustomerOrder): string {
    const [first, ...rest] = order.lines;
    return first
      ? `${first.quantity} ${first.productName}${rest.length ? ` +${rest.length} more` : ''}`
      : '';
  }
  create(_newOrder: NewCustomerOrder): never {
    throw new Error('Customer order creation is available to customer accounts only.');
  }
  updateStatus(
    id: string,
    status:
      'CONFIRMED' | 'PROCESSING' | 'AWAITING_DISPATCH' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED',
  ) {
    return this.http.patch<ApiOrder>(API_ENDPOINTS.distributor.orderStatus(id), { status });
  }
  initiatePayment(orderId: string, phoneNumber: string) {
    return this.http.post<PaymentInitiateResponse>(API_ENDPOINTS.distributor.paymentInitiate, {
      orderId,
      phoneNumber,
    });
  }
  getPaymentStatus(orderId: string) {
    return this.http.get<PaymentStatusResponse>(API_ENDPOINTS.distributor.paymentStatus(orderId));
  }
  recordPaymentStatus(orderId: string, status: string): void {
    const mapped: PaymentStatus =
      status === 'CONFIRMED' || status === 'RECONCILED' ? 'PAID' : 'PENDING';
    this.paymentStatuses.update((rows) => ({ ...rows, [orderId]: mapped }));
    this.orderRecords.update((rows) =>
      rows.map((order) => (order.id === orderId ? { ...order, paymentStatus: mapped } : order)),
    );
  }
  dispatch(_id: string, _vehicleId: string, _driverId: string): never {
    throw new Error(
      'Fleet assignment is not available until the backend exposes fleet assignment APIs.',
    );
  }
  confirmDelivery(_id: string): never {
    throw new Error('Delivery confirmation requires the backend delivery workflow.');
  }
  private enrichOrderProducts(rows: ApiOrder[]): void {
    const productIds = [
      ...new Set(rows.flatMap((row) => (row.items ?? []).map((item) => item.stockItemId))),
    ];
    for (const productId of productIds) {
      this.http
        .get<ApiStockItem>(API_ENDPOINTS.distributor.stockItem(productId))
        .subscribe({
          next: (product) =>
            this.orderRecords.update((orders) =>
              orders.map((order) => ({
                ...order,
                lines: order.lines.map((line) =>
                  line.sku === productId
                    ? { ...line, sku: product.sku, productName: product.name }
                    : line,
                ),
              })),
            ),
        });
    }
  }
  private toOrder(row: ApiOrder): CustomerOrder {
    const status = row.status as CustomerOrder['status'];
    const lines = (row.items ?? []).map((item) => ({
      sku: item.stockItemId,
      productName: item.stockItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unit: '—',
    }));
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      customerId: row.customerId,
      customerName: row.customerId,
      destinationName: row.deliveryAddress,
      destinationAddress: row.deliveryAddress,
      orderDate: row.placedAt,
      paymentStatus:
        this.paymentStatuses()[row.id] ??
        (row.paymentStatus === 'PAID' || row.paymentStatus === 'PENDING'
          ? row.paymentStatus
          : 'UNKNOWN'),
      status,
      deliveryStatus:
        status === 'DELIVERED' ? 'DELIVERED' : status === 'IN_TRANSIT' ? 'ON_ROUTE' : 'UNKNOWN',
      lines,
      log: [],
    };
  }
}
