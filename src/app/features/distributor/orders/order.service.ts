import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_CONFIG } from '../../../core/api/api.config';
import { CustomerOrder, CustomerOrderLine, DistributorShipmentGroup, NewCustomerOrder } from './order.models';

interface ApiOrder {
  id: string; orderNumber: string; customerId: string; organizationId: string; status: string;
  deliveryAddress: string; subtotalAmount: number; totalAmount: number; placedAt: string; paymentStatus?: string;
  items?: { stockItemId: string; quantity: number; unitPrice: number }[];
}
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class DistributorOrderService {
  private readonly http = inject(HttpClient);
  private readonly orderRecords = signal<CustomerOrder[]>([]);
  readonly orders = this.orderRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly activeOrders = computed(() => this.orderRecords().filter(order => !['COMPLETED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED'].includes(order.status)));
  readonly groupedShipments = computed<DistributorShipmentGroup[]>(() => []);

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<ApiOrder> | ApiOrder[]>(`${API_CONFIG.baseUrl}/orders`).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.orderRecords.set(rows.map(row => this.toOrder(row)));
        this.error.set(''); this.loading.set(false);
      },
      error: () => { this.error.set('Orders could not be loaded from the API.'); this.loading.set(false); }
    });
  }

  findById(id: string): CustomerOrder | undefined { return this.orderRecords().find(order => order.id === id); }
  groupOrdersByRoute(): DistributorShipmentGroup[] { return []; }
  findShipmentForOrder(_orderId: string): DistributorShipmentGroup | undefined { return undefined; }
  total(order: { lines: CustomerOrderLine[] }): number { return order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0); }
  itemSummary(order: CustomerOrder): string {
    const [first, ...rest] = order.lines;
    return first ? `${first.quantity} ${first.productName}${rest.length ? ` +${rest.length} more` : ''}` : '';
  }

  create(_newOrder: NewCustomerOrder): never {
    throw new Error('Customer order creation is available to customer accounts only.');
  }

  updateStatus(id: string, status: 'CONFIRMED' | 'PROCESSING' | 'AWAITING_DISPATCH' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED') {
    return this.http.patch<ApiOrder>(`${API_CONFIG.baseUrl}/orders/${encodeURIComponent(id)}/status`, { status });
  }

  markPaid(_id: string): never { throw new Error('Payment must be initiated through the payment API.'); }
  dispatch(_id: string, _vehicleId: string, _driverId: string): never { throw new Error('Fleet assignment is not available until the backend exposes fleet assignment APIs.'); }
  confirmDelivery(_id: string): never { throw new Error('Delivery confirmation requires the backend delivery workflow.'); }

  private toOrder(row: ApiOrder): CustomerOrder {
    const status = row.status as CustomerOrder['status'];
    const lines = (row.items ?? []).map(item => ({ sku: item.stockItemId, productName: item.stockItemId, quantity: item.quantity, unitPrice: item.unitPrice, unit: '—' }));
    return {
      id: row.id, customerId: row.customerId, customerName: row.customerId,
      destinationName: row.deliveryAddress, destinationAddress: row.deliveryAddress,
      orderDate: row.placedAt, paymentStatus: row.paymentStatus === 'PAID' || row.paymentStatus === 'PENDING' ? row.paymentStatus : 'UNKNOWN', status,
      deliveryStatus: status === 'DELIVERED' ? 'DELIVERED' : status === 'IN_TRANSIT' ? 'ON_ROUTE' : 'UNKNOWN',
      lines, log: []
    };
  }
}
