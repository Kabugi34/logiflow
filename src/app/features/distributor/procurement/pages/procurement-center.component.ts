import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { printPurchaseOrderPdf } from '../purchase-order-pdf';
import { DistributorProcurementService } from '../procurement.service';
import { DistributorPurchaseOrder, ProcurementStatus } from '../procurement.models';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';

@Component({
  selector: 'app-procurement-center',
  imports: [CurrencyPipe, DatePipe, LoadingSkeletonComponent, RouterLink],
  templateUrl: './procurement-center.component.html',
})
export class ProcurementCenterComponent implements OnInit {
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly searchTerm = signal('');
  protected readonly selectedStatus = signal<'ALL' | ProcurementStatus>('ALL');
  protected readonly exportError = signal('');

  ngOnInit(): void {
    this.procurement.refreshOrders();
  }
  protected readonly filteredOrders = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.procurement.orders().filter((order) => {
      const matchesQuery =
        !query ||
        [
          order.id,
          order.manufacturerName,
          order.lines.map((line) => line.productName).join(' '),
        ].some((value) => value.toLowerCase().includes(query));
      const matchesStatus =
        this.selectedStatus() === 'ALL' || order.status === this.selectedStatus();
      return matchesQuery && matchesStatus;
    });
  });
  protected readonly submittedCount = computed(() => this.procurement.orders().filter((order) => order.status === 'SUBMITTED').length);

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateStatus(status: 'ALL' | ProcurementStatus): void {
    this.selectedStatus.set(status);
  }

  protected orderStatusClass(status: ProcurementStatus): string {
    switch (status) {
      case 'APPROVED':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'SUBMITTED':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'FULFILLED':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'CANCELLED':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      case 'REJECTED':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'UNKNOWN':
        return 'border-slate-200 bg-slate-50 text-slate-600';
    }
  }

  protected orderStatusLabel(order: DistributorPurchaseOrder): string {
    if (order.status === 'FULFILLED') return 'Fulfilled';
    if (order.status === 'REJECTED' || order.status === 'CANCELLED') return order.status;
    if (order.paymentStatus === 'PAID') return 'Paid — Awaiting Fulfilment';
    if (order.paymentStatus === 'PENDING') return 'Payment pending';
    if (order.status === 'SUBMITTED') return 'Awaiting manufacturer review';
    if (order.status === 'APPROVED') return `Awaiting payment · ${order.paymentStatus}`;
    return 'Purchase status unavailable';
  }

  protected itemSummary(order: { lines: { quantity: number; productName: string }[] }): string {
    const first = order.lines[0];
    if (!first) return 'No items';
    return order.lines.length === 1
      ? `${first.quantity} ${first.productName}`
      : `${first.quantity} ${first.productName} + ${order.lines.length - 1} more`;
  }

  protected exportPdf(order: DistributorPurchaseOrder): void {
    this.exportError.set('');
    if (!printPurchaseOrderPdf(order, this.procurement.total(order))) {
      this.exportError.set('Allow pop-ups for LogiFlow to export this purchase order as a PDF.');
    }
  }
}
