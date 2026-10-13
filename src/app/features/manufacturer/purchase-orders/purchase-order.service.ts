import { computed, inject, Injectable } from '@angular/core';
import { LogisticsService } from '../../../core/logistics/logistics.service';
import { ManufacturerProductService } from '../products/product.service';
import { ManufacturerPurchaseOrder, PurchaseOrderStatus } from './purchase-order.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerPurchaseOrderService {
  private readonly logisticsService = inject(LogisticsService);
  private readonly productService = inject(ManufacturerProductService);
  readonly orders = computed<ManufacturerPurchaseOrder[]>(() => this.logisticsService.inboundOrders().map(order => ({
    id: order.id,
    distributorName: order.distributorName,
    destinationHub: order.destination,
    issueDate: order.orderDate,
    status: this.purchaseOrderStatus(order.status),
    lines: order.lines.map(line => ({
      productName: line.productName,
      sku: line.sku,
      requestedQuantity: line.quantity,
      availableStock: this.productService.findBySku(line.sku)?.stock ?? 0,
      unitPrice: line.unitCost,
      unit: line.unit
    })),
    timeline: order.timeline.map(event => ({ ...event, occurredAt: order.orderDate }))
  })));

  readonly counts = computed(() => {
    const orders = this.orders();
    return {
      PENDING: orders.filter(order => order.status === 'PENDING').length,
      ACCEPTED: orders.filter(order => order.status === 'ACCEPTED').length,
      REJECTED: orders.filter(order => order.status === 'REJECTED').length,
      FULFILLED: orders.filter(order => order.status === 'FULFILLED').length
    } satisfies Record<PurchaseOrderStatus, number>;
  });

  findById(id: string): ManufacturerPurchaseOrder | undefined {
    return this.orders().find(order => order.id === id);
  }

  updateStatus(id: string, status: PurchaseOrderStatus): void {
    if (status === 'ACCEPTED') this.logisticsService.updateInboundStatus(id, 'PROCESSING');
    if (status === 'REJECTED') this.logisticsService.updateInboundStatus(id, 'REJECTED');
  }

  private purchaseOrderStatus(status: 'PENDING' | 'PROCESSING' | 'REJECTED' | 'IN_TRANSIT' | 'DELIVERED'): PurchaseOrderStatus {
    if (status === 'PROCESSING') return 'ACCEPTED';
    if (status === 'IN_TRANSIT' || status === 'DELIVERED') return 'FULFILLED';
    return status;
  }
}
