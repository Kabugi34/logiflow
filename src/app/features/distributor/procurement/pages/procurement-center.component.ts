import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DistributorProcurementService } from '../procurement.service';
import { ProcurementStatus } from '../procurement.models';

@Component({
  selector: 'app-procurement-center',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './procurement-center.component.html'
})
export class ProcurementCenterComponent {
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly searchTerm = signal('');
  protected readonly selectedStatus = signal<'ALL' | ProcurementStatus>('ALL');
  protected readonly filteredOrders = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.procurement.orders().filter(order => {
      const matchesQuery = !query || [order.id, order.manufacturerName, order.lines.map(line => line.productName).join(' ')].some(value => value.toLowerCase().includes(query));
      const matchesStatus = this.selectedStatus() === 'ALL' || order.status === this.selectedStatus();
      return matchesQuery && matchesStatus;
    });
  });

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateStatus(status: 'ALL' | ProcurementStatus): void {
    this.selectedStatus.set(status);
  }

  protected orderStatusClass(status: ProcurementStatus): string {
    switch (status) {
      case 'IN_TRANSIT': return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'PROCESSING': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'PENDING': return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'DELIVERED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'REJECTED': return 'border-red-200 bg-red-50 text-red-700';
    }
  }

  protected itemSummary(order: { lines: { quantity: number; productName: string }[] }): string {
    const first = order.lines[0];
    if (!first) return 'No items';
    return order.lines.length === 1 ? `${first.quantity} ${first.productName}` : `${first.quantity} ${first.productName} + ${order.lines.length - 1} more`;
  }
}