import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ManufacturerPurchaseOrderService } from '../purchase-order.service';
import { PurchaseOrderStatus } from '../purchase-order.models';
import { PurchaseOrderStatusComponent } from '../components/purchase-order-status/purchase-order-status.component';
import { finalize } from 'rxjs';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';

@Component({
  selector: 'app-purchase-order-list',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, LoadingSkeletonComponent, RouterLink, PurchaseOrderStatusComponent],
  templateUrl: './purchase-order-list.component.html'
})
export class PurchaseOrderListComponent {
  protected readonly orderService = inject(ManufacturerPurchaseOrderService);
  protected readonly activeStatus = signal<PurchaseOrderStatus>('PENDING');
  protected readonly exportError = signal('');
  protected readonly updatingOrderId = signal('');
  protected readonly orders = computed(() => this.orderService.orders().filter(order => order.status === this.activeStatus()));
  protected readonly counts = this.orderService.counts;

  protected total(order: { lines: { requestedQuantity: number; unitPrice: number }[] }): number {
    return order.lines.reduce((sum, line) => sum + line.requestedQuantity * line.unitPrice, 0);
  }

  protected setStatus(status: PurchaseOrderStatus): void {
    this.activeStatus.set(status);
  }

  protected approve(orderId: string): void {
    if (this.updatingOrderId()) return;
    this.updatingOrderId.set(orderId);
    this.orderService.updateStatus(orderId, 'ACCEPTED').pipe(
      finalize(() => this.updatingOrderId.set('')),
    ).subscribe({ error: () => this.orderService.error.set('The purchase order decision could not be saved.') });
  }

  protected exportPdf(): void {
    this.exportError.set('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.exportError.set('Allow pop-ups for LogiFlow to export purchase orders as a PDF.');
      return;
    }

    const escapeHtml = (value: string): string =>
      value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        };
        return entities[character];
      });
    const currency = (amount: number): string =>
      new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
    const rows = this.orderService.orders().map(order => `
      <tr>
        <td>${escapeHtml(order.id)}</td>
        <td>${escapeHtml(order.distributorName)}</td>
        <td>${escapeHtml(order.issueDate)}</td>
        <td>${order.lines.map(line => `${line.requestedQuantity} ${escapeHtml(line.productName)}`).join('<br>')}</td>
        <td class="number">${currency(this.total(order))}</td>
        <td>${escapeHtml(order.status)}</td>
      </tr>`).join('');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <title>Manufacturer Purchase Orders</title><style>
        @page { size: A4 landscape; margin: 15mm; }
        body { color: #172033; font: 12px/1.5 Arial, sans-serif; }
        header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
        .brand { color: #1d4ed8; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        h1 { margin: 5px 0; font-size: 22px; }
        p { margin: 0; color: #64748b; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; color: #475569; text-align: left; font-size: 10px; text-transform: uppercase; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 9px 7px; vertical-align: top; }
        .number { text-align: right; white-space: nowrap; }
        footer { margin-top: 20px; color: #64748b; font-size: 10px; }
      </style></head><body>
      <header><div class="brand">LogiFlow · Manufacturer Workspace</div><h1>Distributor Purchase Orders</h1>
      <p>${this.orderService.orders().length} purchase orders · Generated ${new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(new Date())}</p></header>
      <table><thead><tr><th>PO Number</th><th>Distributor</th><th>Issue Date</th><th>Products</th><th class="number">Total Value</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No purchase orders found.</td></tr>'}</tbody></table>
      <footer>LogiFlow purchase order report</footer></body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }
}
