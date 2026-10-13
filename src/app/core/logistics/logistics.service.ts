import { computed, Injectable, signal } from '@angular/core';
import { InboundLogisticsOrder, InboundLogisticsStatus, LogisticsRoutePoint, LogisticsTimelineEvent } from './logistics.models';

const nairobiToMombasa: LogisticsRoutePoint[] = [
  { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi Distribution Centre' },
  { latitude: -0.7172, longitude: 36.4310, label: 'Naivasha Checkpoint' },
  { latitude: -3.3960, longitude: 38.5560, label: 'Voi Checkpoint' },
  { latitude: -4.0435, longitude: 39.6682, label: 'Mombasa Freight Terminal' }
];

const nairobiToKisumu: LogisticsRoutePoint[] = [
  { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi Distribution Centre' },
  { latitude: -0.3031, longitude: 36.0800, label: 'Nakuru Checkpoint' },
  { latitude: -0.0917, longitude: 34.7680, label: 'Kisumu Distribution Warehouse' }
];

const initialInboundOrders: InboundLogisticsOrder[] = [
  {
    id: 'PO-2026-081', manufacturerId: 'MFG-TITAN', manufacturerName: 'Titan Industrial Foundries Ltd', manufacturerLocation: 'Industrial Area, Nairobi', distributorName: 'Vance Distributors', orderDate: '2026-09-24', expectedDelivery: '2026-10-08', status: 'IN_TRANSIT', destination: 'Nairobi Distribution Centre', logisticsCost: 3200,
    lines: [
      { sku: 'HDM-092-X', productName: 'Heavy Duty Hydraulic Motor', quantity: 40, unit: 'Pcs', unitCost: 180000 },
      { sku: 'PCV-404-Z', productName: 'Pneumatic Control Valve', quantity: 50, unit: 'Pcs', unitCost: 110000 }
    ],
    timeline: [
      { title: 'Purchase order approved', detail: '24 Sep · Manufacturer confirmed quantities and pricing.', state: 'COMPLETE' },
      { title: 'Fulfilment complete', detail: '25 Sep · Packed at Nairobi Industrial Area.', state: 'COMPLETE' },
      { title: 'Dispatched from manufacturer', detail: '26 Sep · TRP-8012 departed Nairobi.', state: 'CURRENT' },
      { title: 'Expected arrival', detail: '08 Oct · Nairobi Distribution Centre, Gate 1.', state: 'UPCOMING' }
    ],
    shipmentId: 'SHP-094', tripId: 'TRP-8012', driverName: 'Daniel Kamau', vehicleLabel: 'Isuzu FVR · KDA 123A', route: nairobiToMombasa, currentRouteIndex: 2
  },
  {
    id: 'PO-2026-080', manufacturerId: 'MFG-APEX', manufacturerName: 'Apex Hydraulic Assemblies Kenya Ltd', manufacturerLocation: 'Athi River, Machakos County', distributorName: 'Vance Distributors', orderDate: '2026-09-22', expectedDelivery: '2026-11-02', status: 'PROCESSING', destination: 'Mombasa Freight Terminal', logisticsCost: 0,
    lines: [{ sku: 'HPG-881-A', productName: 'High-Precision Gear Box', quantity: 300, unit: 'Pcs', unitCost: 28500 }],
    timeline: [
      { title: 'Purchase order approved', detail: '22 Sep · Manufacturer accepted the order.', state: 'COMPLETE' },
      { title: 'Production and packing', detail: 'Apex team preparing the order at Athi River.', state: 'CURRENT' },
      { title: 'Expected dispatch', detail: '02 Nov · Delivery to Mombasa Freight Terminal.', state: 'UPCOMING' }
    ],
    route: nairobiToMombasa, currentRouteIndex: 0
  },
  {
    id: 'PO-2026-079', manufacturerId: 'MFG-VOLTLINE', manufacturerName: 'VoltLine Electrical Kenya Ltd', manufacturerLocation: 'Nakuru, Nakuru County', distributorName: 'Vance Distributors', orderDate: '2026-09-20', expectedDelivery: '2026-11-05', status: 'PENDING', destination: 'Kisumu Distribution Warehouse', logisticsCost: 0,
    lines: [{ sku: 'VRB-332-Y', productName: 'Voltage Regulator Block', quantity: 450, unit: 'Pcs', unitCost: 24800 }],
    timeline: [
      { title: 'Draft submitted', detail: '20 Sep · Waiting for manufacturer confirmation.', state: 'CURRENT' },
      { title: 'Expected delivery', detail: '05 Nov · Kisumu Distribution Warehouse.', state: 'UPCOMING' }
    ],
    route: nairobiToKisumu, currentRouteIndex: 0
  },
  {
    id: 'PO-2026-078', manufacturerId: 'MFG-TITAN', manufacturerName: 'Titan Industrial Foundries Ltd', manufacturerLocation: 'Industrial Area, Nairobi', distributorName: 'Vance Distributors', orderDate: '2026-09-18', expectedDelivery: '2026-09-23', status: 'DELIVERED', destination: 'Nairobi Distribution Centre', logisticsCost: 1800,
    lines: [{ sku: 'PCV-404-Z', productName: 'Pneumatic Control Valve', quantity: 24, unit: 'Pcs', unitCost: 108000 }],
    timeline: [
      { title: 'Order approved', detail: '18 Sep · Confirmed by Titan Industrial Foundries.', state: 'COMPLETE' },
      { title: 'Delivered', detail: '23 Sep · Received at Nairobi Distribution Centre.', state: 'COMPLETE' }
    ],
    shipmentId: 'SHP-092', tripId: 'TRP-8010', driverName: 'Peter Otieno', vehicleLabel: 'Hino 500 · KDC 789C', route: nairobiToMombasa, currentRouteIndex: 3
  }
];

@Injectable({ providedIn: 'root' })
export class LogisticsService {
  private readonly inboundRecords = signal(initialInboundOrders);

  readonly inboundOrders = this.inboundRecords.asReadonly();
  readonly inboundShipments = computed(() => this.inboundRecords().filter(order => order.status === 'IN_TRANSIT'));

  findInboundOrder(id: string): InboundLogisticsOrder | undefined {
    return this.inboundRecords().find(order => order.id === id);
  }

  createInboundOrder(input: {
    manufacturerId: string;
    manufacturerName: string;
    manufacturerLocation: string;
    distributorName: string;
    destination: string;
    lines: InboundLogisticsOrder['lines'];
  }): string {
    const highestNumber = Math.max(81, ...this.inboundRecords().map(order => Number(order.id.replace('PO-2026-', ''))));
    const id = `PO-2026-${String(highestNumber + 1).padStart(3, '0')}`;
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
    const order: InboundLogisticsOrder = {
      ...input,
      id,
      orderDate: now.toISOString().slice(0, 10),
      expectedDelivery: expected.toISOString().slice(0, 10),
      status: 'PENDING',
      logisticsCost: 0,
      timeline: [{ title: 'Draft submitted', detail: `${now.toLocaleDateString('en-KE')} · Waiting for manufacturer confirmation.`, state: 'CURRENT' }],
      route: this.routeForDestination(input.destination),
      currentRouteIndex: 0
    };
    this.inboundRecords.update(orders => [order, ...orders]);
    return id;
  }

  updateInboundStatus(id: string, status: InboundLogisticsStatus): void {
    const order = this.findInboundOrder(id);
    if (!order) return;
    const title = status === 'PROCESSING' ? 'Purchase order accepted'
      : status === 'REJECTED' ? 'Purchase order rejected'
      : status === 'DELIVERED' ? 'Received at distributor'
      : status === 'IN_TRANSIT' ? 'Dispatched from manufacturer'
      : 'Purchase order submitted';
    const currentEvent: LogisticsTimelineEvent = { title, detail: `Status updated · ${new Date().toLocaleString('en-KE')}.`, state: 'CURRENT' };
    this.inboundRecords.update(orders => orders.map(record => record.id === id
      ? { ...record, status, timeline: [...record.timeline.map(event => ({ ...event, state: event.state === 'CURRENT' ? 'COMPLETE' as const : event.state })), currentEvent] }
      : record));
  }

  dispatchInboundOrder(id: string, dispatch: {
    shipmentId: string;
    tripId: string;
    driverName: string;
    vehicleLabel: string;
    route?: LogisticsRoutePoint[];
  }): boolean {
    const order = this.findInboundOrder(id);
    if (!order || order.status !== 'PROCESSING') return false;
    const route = dispatch.route?.length ? dispatch.route : this.routeForDestination(order.destination);
    const timeline = [...order.timeline.map(event => ({ ...event, state: event.state === 'CURRENT' ? 'COMPLETE' as const : event.state })), {
      title: 'Dispatched from manufacturer',
      detail: `${new Date().toLocaleString('en-KE')} · ${dispatch.tripId} departed ${order.manufacturerLocation}.`,
      state: 'CURRENT' as const
    }];
    this.inboundRecords.update(orders => orders.map(record => record.id === id
      ? { ...record, ...dispatch, route, currentRouteIndex: 0, status: 'IN_TRANSIT', timeline }
      : record));
    return true;
  }

  advanceInboundCheckpoint(id: string): void {
    this.inboundRecords.update(orders => orders.map(order => {
      if (order.id !== id || order.status !== 'IN_TRANSIT') return order;
      const currentRouteIndex = Math.min(order.currentRouteIndex + 1, order.route.length - 1);
      return { ...order, currentRouteIndex };
    }));
  }

  receiveInboundOrder(id: string): void {
    const order = this.findInboundOrder(id);
    if (!order || order.status !== 'IN_TRANSIT') return;
    this.updateInboundStatus(id, 'DELIVERED');
  }

  private routeForDestination(destination: string): LogisticsRoutePoint[] {
    return destination.toLowerCase().includes('kisumu') || destination.toLowerCase().includes('eldoret')
      ? nairobiToKisumu
      : nairobiToMombasa;
  }
}