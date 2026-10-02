import { computed, Injectable, signal } from '@angular/core';
import { ManufacturerPurchaseOrder, PurchaseOrderStatus } from './purchase-order.models';

const initialOrders: ManufacturerPurchaseOrder[] = [
  {
    id: 'PO-2026-981', distributorName: 'Apex Distribution Kenya Ltd', destinationHub: 'Mombasa Freight Depot #4', issueDate: 'Jan 28, 2026', status: 'PENDING',
    lines: [
      { productName: 'Heavy Duty Hydraulic Motor', sku: 'HDM-092-X', requestedQuantity: 140, availableStock: 450, unitPrice: 75000, unit: 'Pcs' },
      { productName: 'High-Precision Gear Box', sku: 'HPG-881-A', requestedQuantity: 30, availableStock: 120, unitPrice: 65000, unit: 'Pcs' }
    ],
    timeline: [
      { title: 'Order Received', detail: 'Jan 28, 2:15 PM', occurredAt: 'Jan 28, 2026', state: 'COMPLETE' },
      { title: 'Stock Audit Synced', detail: 'Jan 28, 2:20 PM', occurredAt: 'Jan 28, 2026', state: 'COMPLETE' },
      { title: 'Awaiting Dispatch Hold', detail: 'Pending Fulfillment Action', occurredAt: 'Jan 28, 2026', state: 'CURRENT' }
    ]
  },
  {
    id: 'PO-2026-982', distributorName: 'Lake Region Supply Ltd', destinationHub: 'Kisumu Distribution Hub', issueDate: 'Jan 28, 2026', status: 'ACCEPTED',
    lines: [{ productName: 'High-Precision Gear Box', sku: 'HPG-881-A', requestedQuantity: 80, availableStock: 120, unitPrice: 65000, unit: 'Pcs' }],
    timeline: [{ title: 'Order Received', detail: 'Jan 28, 10:30 AM', occurredAt: 'Jan 28, 2026', state: 'COMPLETE' }, { title: 'Accepted', detail: 'Awaiting fulfillment', occurredAt: 'Jan 28, 2026', state: 'CURRENT' }]
  },
  {
    id: 'PO-2026-983', distributorName: 'VoltLine Grid Solutions Kenya', destinationHub: 'Nakuru Industrial Terminal', issueDate: 'Jan 27, 2026', status: 'ACCEPTED',
    lines: [{ productName: 'Voltage Regulator Block', sku: 'VRB-332-Y', requestedQuantity: 300, availableStock: 1240, unitPrice: 55000, unit: 'Pcs' }],
    timeline: [{ title: 'Order Received', detail: 'Jan 27, 11:10 AM', occurredAt: 'Jan 27, 2026', state: 'COMPLETE' }, { title: 'Accepted', detail: 'Stock reserved', occurredAt: 'Jan 27, 2026', state: 'CURRENT' }]
  },
  {
    id: 'PO-2026-984', distributorName: 'Coastline Freight Traders', destinationHub: 'Mombasa Cargo Centre', issueDate: 'Jan 25, 2026', status: 'FULFILLED',
    lines: [{ productName: 'Micro Valves', sku: 'MV-221-K', requestedQuantity: 1200, availableStock: 2400, unitPrice: 35000, unit: 'Pcs' }],
    timeline: [{ title: 'Order Received', detail: 'Jan 25, 9:00 AM', occurredAt: 'Jan 25, 2026', state: 'COMPLETE' }, { title: 'Manifest Generated', detail: 'Dispatch scheduled', occurredAt: 'Jan 25, 2026', state: 'COMPLETE' }]
  },
  {
    id: 'PO-2026-985', distributorName: 'Rift Valley Industrial Supplies', destinationHub: 'Eldoret Supply Depot', issueDate: 'Jan 24, 2026', status: 'REJECTED',
    lines: [{ productName: 'Control Boards', sku: 'CB-100-Q', requestedQuantity: 45, availableStock: 300, unitPrice: 28000, unit: 'Pcs' }],
    timeline: [{ title: 'Order Received', detail: 'Jan 24, 8:00 AM', occurredAt: 'Jan 24, 2026', state: 'COMPLETE' }, { title: 'Rejected', detail: 'Insufficient inventory', occurredAt: 'Jan 24, 2026', state: 'CURRENT' }]
  }
];

@Injectable({ providedIn: 'root' })
export class ManufacturerPurchaseOrderService {
  private readonly orderRecords = signal(initialOrders);
  readonly orders = this.orderRecords.asReadonly();

  readonly counts = computed(() => {
    const orders = this.orderRecords();
    return {
      PENDING: orders.filter(order => order.status === 'PENDING').length,
      ACCEPTED: orders.filter(order => order.status === 'ACCEPTED').length,
      REJECTED: orders.filter(order => order.status === 'REJECTED').length,
      FULFILLED: orders.filter(order => order.status === 'FULFILLED').length
    } satisfies Record<PurchaseOrderStatus, number>;
  });

  findById(id: string): ManufacturerPurchaseOrder | undefined {
    return this.orderRecords().find(order => order.id === id);
  }

  updateStatus(id: string, status: PurchaseOrderStatus): void {
    this.orderRecords.update(orders => orders.map(order => {
      if (order.id !== id) return order;
      const eventTitle = status === 'FULFILLED' ? 'Manifest Generated' : status === 'ACCEPTED' ? 'Order Accepted' : 'Order Rejected';
      return {
        ...order,
        status,
        timeline: [...order.timeline, {
          title: eventTitle,
          detail: status === 'FULFILLED' ? 'Dispatch manifest created' : `Status updated to ${status.toLowerCase()}`,
          occurredAt: 'Just now',
          state: 'COMPLETE'
        }]
      };
    }));
  }
}
