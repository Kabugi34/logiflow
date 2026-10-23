import { computed, inject, Injectable } from '@angular/core';
import { DashboardPurchaseOrder, DashboardAttentionItem, DashboardDriver, DashboardShipment, ManufacturerDashboard } from './dashboard.models';
import { ManufacturerProductService } from '../products/product.service';
import { ManufacturerPurchaseOrderService } from '../purchase-orders/purchase-order.service';

@Injectable({ providedIn: 'root' })
export class ManufacturerDashboardService {
  private readonly productService = inject(ManufacturerProductService);
  private readonly purchaseOrderService = inject(ManufacturerPurchaseOrderService);
  readonly loading = computed(() => this.purchaseOrderService.loading() || this.productService.loading());
  // The backend currently has no dashboard aggregation endpoint. Avoid showing fabricated KPI values.
  getDashboard(): ManufacturerDashboard {
    const pending = this.purchaseOrderService.orders().filter(order => order.status === 'PENDING');
    return { activeDispatchFleet: 0, activeDrivers: 0, availableDrivers: 0, activeShipments: 0, delayedShipments: 0,
      pendingPurchaseOrders: pending.length,
      pendingPurchaseOrderValue: pending.reduce((sum, order) => sum + order.lines.reduce((lineTotal, line) => lineTotal + line.requestedQuantity * line.unitPrice, 0), 0),
      deliveriesToday: 0, deliveriesOnTrackPercentage: 0 };
  }
  getPendingPurchaseOrders(): DashboardPurchaseOrder[] {
    return this.purchaseOrderService.orders().filter(order => order.status === 'PENDING').map(order => ({
      id: order.id, orderNumber: order.id, distributorName: order.distributorName,
      itemSummary: order.lines.map(line => `${line.requestedQuantity} ${line.productName}`).join(', '),
      totalAmount: order.lines.reduce((sum, line) => sum + line.requestedQuantity * line.unitPrice, 0), status: 'PENDING'
    }));
  }
  getActiveShipments(): DashboardShipment[] { return []; }
  getFleetDrivers(): DashboardDriver[] { return []; }
  getAttentionItems(): DashboardAttentionItem[] {
    return this.productService.products().filter(product => product.status !== 'ACTIVE').map(product => ({
      id: product.id, title: 'Low stock', description: `${product.name} (${product.sku}) needs replenishment.`,
      severity: product.status === 'CRITICAL STOCK' ? 'CRITICAL' : 'WARNING',
      actionLabel: 'View product', route: `/manufacturer/products/${product.sku}`
    }));
  }
}
