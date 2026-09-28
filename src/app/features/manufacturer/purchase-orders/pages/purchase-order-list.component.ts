import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ManufacturerPurchaseOrderService } from '../purchase-order.service';
import { PurchaseOrderStatus } from '../purchase-order.models';
import { PurchaseOrderStatusComponent } from '../components/purchase-order-status/purchase-order-status.component';

@Component({
  selector: 'app-purchase-order-list',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, RouterLink, PurchaseOrderStatusComponent],
  templateUrl: './purchase-order-list.component.html'
})
export class PurchaseOrderListComponent {
  private readonly orderService = inject(ManufacturerPurchaseOrderService);
  protected readonly activeStatus = signal<PurchaseOrderStatus>('PENDING');
  protected readonly orders = computed(() => this.orderService.orders().filter(order => order.status === this.activeStatus()));
  protected readonly counts = this.orderService.counts;

  protected total(order: { lines: { requestedQuantity: number; unitPrice: number }[] }): number {
    return order.lines.reduce((sum, line) => sum + line.requestedQuantity * line.unitPrice, 0);
  }

  protected setStatus(status: PurchaseOrderStatus): void {
    this.activeStatus.set(status);
  }

  protected approve(orderId: string): void {
    this.orderService.updateStatus(orderId, 'ACCEPTED');
  }

  protected exportCsv(): void {
    const header = ['PO Number', 'Distributor Client', 'Issue Date', 'Procured Items', 'Total Value', 'Status'];
    const rows = this.orderService.orders().map(order => [
      order.id,
      order.distributorName,
      order.issueDate,
      order.lines.map(line => `${line.requestedQuantity} ${line.productName}`).join('; '),
      this.total(order).toFixed(2),
      order.status
    ]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const file = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'manufacturer-purchase-orders.csv';
    download.click();
    URL.revokeObjectURL(url);
  }
}
