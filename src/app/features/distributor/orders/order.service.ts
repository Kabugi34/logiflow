import { computed, inject, Injectable, signal } from '@angular/core';
import { DistributorCustomerService } from '../customers/customer.service';
import { DistributorFleetService } from '../fleet/fleet.service';
import { DistributorInventoryService } from '../inventory/inventory.service';
import { CustomerOrder, CustomerOrderLine, DistributorShipmentGroup, NewCustomerOrder, OrderLogEvent } from './order.models';

const initialOrders: CustomerOrder[] = [
  {
    id: 'ORD-90214', customerId: 'CL-MET-991', customerName: 'Metro Retail Nairobi', destinationName: 'Westlands Distribution Hub', destinationAddress: 'Waiyaki Way, Westlands, Nairobi',
    orderDate: '2026-09-28', paymentStatus: 'PAID', status: 'PREPARING', deliveryStatus: 'UNASSIGNED',
    lines: [
      { sku: 'HDM-092-X', productName: 'Heavy Duty Hydraulic Motor', quantity: 14, unitPrice: 97500, unit: 'Pcs' },
      { sku: 'HPG-881-A', productName: 'High-Precision Gear Box', quantity: 3, unitPrice: 84500, unit: 'Pcs' }
    ],
    log: [
      { title: 'Order Confirmed & Paid', detail: 'Sep 28 at 08:32 · Vance billing verified.', state: 'COMPLETE' },
      { title: 'Packaging Completed', detail: 'Sep 28 at 09:14 · Nairobi Warehouse Gate #3.', state: 'CURRENT' }
    ]
  },
  {
    id: 'ORD-88104', customerId: 'CL-PAC-204', customerName: 'Coastline Retail Mombasa', destinationName: 'Shimanzi Receiving Dock 2', destinationAddress: 'Shimanzi Road, Mombasa',
    orderDate: '2026-09-27', paymentStatus: 'PAID', status: 'IN_TRANSIT', deliveryStatus: 'ON_ROUTE', vehicleId: 'TRK-09214', driverId: 'DRV-102',
    lines: [
      { sku: 'PCV-404-Z', productName: 'Pneumatic Control Valve', quantity: 8, unitPrice: 65000, unit: 'Pcs' },
      { sku: 'VRB-332-Y', productName: 'Voltage Regulator Block', quantity: 2, unitPrice: 78000, unit: 'Pcs' }
    ],
    log: [
      { title: 'Order Confirmed & Paid', detail: 'Sep 27 at 10:05 · Wire transfer received.', state: 'COMPLETE' },
      { title: 'Packaging Completed', detail: 'Sep 27 at 13:40 · Nairobi Warehouse Gate #1.', state: 'COMPLETE' },
      { title: 'Dispatched', detail: 'Sep 27 at 15:20 · TRK-09214 with Sarah Connor.', state: 'CURRENT' }
    ]
  },
  {
    id: 'ORD-33291', customerId: 'CL-VLT-310', customerName: 'VoltLine Solutions Kenya', destinationName: 'VoltLine Receiving Yard', destinationAddress: 'Mombasa Road, Athi River',
    orderDate: '2026-09-27', paymentStatus: 'PENDING', status: 'REROUTED', deliveryStatus: 'HOLD', vehicleId: 'TRK-33190', driverId: 'DRV-103',
    lines: [
      { sku: 'VRB-332-Y', productName: 'Voltage Regulator Block', quantity: 180, unitPrice: 78000, unit: 'Pcs' },
      { sku: 'HDM-092-X', productName: 'Heavy Duty Hydraulic Motor', quantity: 5, unitPrice: 97500, unit: 'Pcs' }
    ],
    log: [
      { title: 'Order Confirmed', detail: 'Sep 27 at 08:10 · Net-30 invoice issued.', state: 'COMPLETE' },
      { title: 'Dispatched', detail: 'Sep 27 at 11:45 · TRK-33190 with David Jenkins.', state: 'COMPLETE' },
      { title: 'Rerouted & On Hold', detail: 'Sep 27 at 14:02 · Athi River roadworks, awaiting clearance.', state: 'CURRENT' }
    ]
  },
  {
    id: 'ORD-12049', customerId: 'CL-IST-118', customerName: 'Lake Region Supply Ltd', destinationName: 'Kisumu Distribution Warehouse', destinationAddress: 'Kisumu-Kakamega Road, Kisumu',
    orderDate: '2026-09-26', paymentStatus: 'PAID', status: 'COMPLETED', deliveryStatus: 'DELIVERED',
    lines: [{ sku: 'GA-210-C', productName: 'Gear Assembly Unit', quantity: 50, unitPrice: 23660, unit: 'Pcs' }],
    log: [
      { title: 'Order Confirmed & Paid', detail: 'Sep 26 at 09:00 · Card payment captured.', state: 'COMPLETE' },
      { title: 'Delivered', detail: 'Sep 26 at 16:30 · Signed by receiving clerk.', state: 'COMPLETE' }
    ]
  },
  {
    id: 'ORD-11928', customerId: 'CL-NTM-452', customerName: 'Rift Valley Machinery', destinationName: 'Rift Valley Plant Gate 1', destinationAddress: 'Uganda Road, Eldoret',
    orderDate: '2026-09-26', paymentStatus: 'PAID', status: 'COMPLETED', deliveryStatus: 'DELIVERED',
    lines: [{ sku: 'CSM-118-B', productName: 'Compact Servo Motor', quantity: 10, unitPrice: 110500, unit: 'Pcs' }],
    log: [
      { title: 'Order Confirmed & Paid', detail: 'Sep 26 at 07:45 · Wire transfer received.', state: 'COMPLETE' },
      { title: 'Delivered', detail: 'Sep 26 at 18:10 · Signed by plant supervisor.', state: 'COMPLETE' }
    ]
  }
];

@Injectable({ providedIn: 'root' })
export class DistributorOrderService {
  private readonly customerService = inject(DistributorCustomerService);
  private readonly fleetService = inject(DistributorFleetService);
  private readonly inventoryService = inject(DistributorInventoryService);
  private readonly orderRecords = signal(initialOrders);

  readonly orders = this.orderRecords.asReadonly();
  readonly activeOrders = computed(() => this.orderRecords().filter(order => order.status !== 'COMPLETED'));
  readonly groupedShipments = computed<DistributorShipmentGroup[]>(() => this.groupOrdersByRoute());

  findById(id: string): CustomerOrder | undefined {
    return this.orderRecords().find(order => order.id === id);
  }

  groupOrdersByRoute(): DistributorShipmentGroup[] {
    const groups = new Map<string, DistributorShipmentGroup>();
    const activeOrders = this.orderRecords().filter(order => order.status !== 'COMPLETED');

    for (const order of activeOrders) {
      const routeKey = this.routeKeyForOrder(order);
      const existing = groups.get(routeKey);

      if (existing) {
        existing.orderIds.push(order.id);
        existing.orders.push(order);
        existing.totalValue += this.total(order);
        existing.driverId ??= order.driverId;
        existing.vehicleId ??= order.vehicleId;
        existing.status = this.resolveShipmentStatus(existing.status, order.status);
        existing.routeLabel = existing.routeLabel || order.destinationName;
        continue;
      }

      groups.set(routeKey, {
        id: `SHP-${String(groups.size + 1).padStart(3, '0')}`,
        routeKey,
        routeLabel: order.destinationName,
        status: order.status,
        orderIds: [order.id],
        orders: [order],
        driverId: order.driverId,
        vehicleId: order.vehicleId,
        totalValue: this.total(order)
      });
    }

    return [...groups.values()].sort((left, right) => right.totalValue - left.totalValue);
  }

  findShipmentForOrder(orderId: string): DistributorShipmentGroup | undefined {
    return this.groupOrdersByRoute().find(group => group.orderIds.includes(orderId));
  }

  total(order: { lines: CustomerOrderLine[] }): number {
    return order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  }

  itemSummary(order: CustomerOrder): string {
    const [first, ...rest] = order.lines;
    if (!first) return '';
    return rest.length ? `${first.quantity} ${first.productName} +${rest.length} more` : `${first.quantity} ${first.productName}`;
  }

  create(newOrder: NewCustomerOrder): string {
    const customer = this.customerService.findById(newOrder.customerId);
    if (!customer) throw new Error('Select a valid customer store.');
    if (!newOrder.lines.length) throw new Error('Add at least one item to the order.');

    const lines = newOrder.lines.map(line => {
      const item = this.inventoryService.findBySku(line.sku);
      if (!item) throw new Error('Select a valid catalog item for every line.');
      return { sku: item.sku, productName: item.name, quantity: line.quantity, unitPrice: item.unitPrice, unit: item.unit };
    });
    const id = `ORD-${Math.max(0, ...this.orderRecords().map(order => Number(order.id.replace('ORD-', '')))) + 1}`;
    const paid = newOrder.paymentStatus === 'PAID';

    this.orderRecords.update(orders => [{
      id,
      customerId: customer.id,
      customerName: customer.storeName,
      destinationName: customer.destinationName,
      destinationAddress: customer.destinationAddress,
      orderDate: todayIsoDate(),
      paymentStatus: newOrder.paymentStatus,
      status: 'PREPARING',
      deliveryStatus: 'UNASSIGNED',
      lines,
      log: [{ title: paid ? 'Order Confirmed & Paid' : 'Order Confirmed', detail: `${timestamp()} · Created by distributor staff.`, state: 'CURRENT' }]
    }, ...orders]);
    return id;
  }

  markPaid(id: string): void {
    const order = this.findById(id);
    if (!order || order.paymentStatus === 'PAID') return;
    this.updateOrder(id, { paymentStatus: 'PAID' }, { title: 'Payment Received', detail: `${timestamp()} · Payment recorded.` });
  }

  dispatch(id: string, vehicleId: string, driverId: string): void {
    const order = this.findById(id);
    if (!order || order.status !== 'PREPARING') throw new Error('Only orders being prepared can be dispatched.');
    const shortLine = order.lines.find(line => (this.inventoryService.findBySku(line.sku)?.onHand ?? 0) < line.quantity);
    if (shortLine) throw new Error(`Not enough local stock for ${shortLine.productName}.`);

    this.fleetService.assign(id, vehicleId, driverId);
    this.inventoryService.deduct(order.lines.map(line => ({ sku: line.sku, quantity: line.quantity })));
    const driverName = this.fleetService.findDriver(driverId)?.name ?? 'assigned driver';
    this.updateOrder(id, { status: 'IN_TRANSIT', deliveryStatus: 'ON_ROUTE', vehicleId, driverId }, { title: 'Dispatched', detail: `${timestamp()} · ${vehicleId} with ${driverName}.` });
  }

  confirmDelivery(id: string): void {
    const order = this.findById(id);
    if (!order || (order.status !== 'IN_TRANSIT' && order.status !== 'REROUTED')) return;
    this.fleetService.release(id);
    this.updateOrder(id, { status: 'COMPLETED', deliveryStatus: 'DELIVERED' }, { title: 'Delivered', detail: `${timestamp()} · Delivery confirmed.` }, 'COMPLETE');
  }

  private updateOrder(id: string, changes: Partial<CustomerOrder>, event: Omit<OrderLogEvent, 'state'>, state: OrderLogEvent['state'] = 'CURRENT'): void {
    this.orderRecords.update(orders => orders.map(order => order.id === id
      ? {
          ...order,
          ...changes,
          log: [...order.log.map(entry => ({ ...entry, state: 'COMPLETE' as const })), { ...event, state }]
        }
      : order));
  }

  private routeKeyForOrder(order: CustomerOrder): string {
    return order.destinationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general-route';
  }

  private resolveShipmentStatus(current: CustomerOrder['status'], next: CustomerOrder['status']): CustomerOrder['status'] {
    if (next === 'REROUTED' || current === 'REROUTED') return 'REROUTED';
    if (next === 'IN_TRANSIT' || current === 'IN_TRANSIT') return 'IN_TRANSIT';
    if (next === 'PREPARING' || current === 'PREPARING') return 'PREPARING';
    return 'COMPLETED';
  }
}

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function timestamp(): string {
  return `Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}
