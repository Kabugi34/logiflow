import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DistributorOrderService } from '../order.service';
import { CustomerOrderStatus, PaymentStatus } from '../order.models';
import { OrderBadgeComponent } from '../components/order-badge/order-badge.component';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, OrderBadgeComponent],
  templateUrl: './order-list.component.html'
})
export class OrderListComponent {
  protected readonly orderService = inject(DistributorOrderService);
  protected readonly selectedStatus = signal<'ALL' | CustomerOrderStatus>('ALL');
  protected readonly selectedPayment = signal<'ALL' | PaymentStatus>('ALL');
  protected readonly statusOptions: { value: 'ALL' | CustomerOrderStatus; label: string }[] = [
    { value: 'ALL', label: 'All Orders' },
    { value: 'PREPARING', label: 'Preparing' },
    { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'REROUTED', label: 'Rerouted' },
    { value: 'COMPLETED', label: 'Completed' }
  ];
  protected readonly paymentOptions: { value: 'ALL' | PaymentStatus; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'PAID', label: 'Paid' },
    { value: 'PENDING', label: 'Pending' }
  ];
  protected readonly filteredOrders = computed(() => this.orderService.orders().filter(order => {
    const statusMatches = this.selectedStatus() === 'ALL' || order.status === this.selectedStatus();
    const paymentMatches = this.selectedPayment() === 'ALL' || order.paymentStatus === this.selectedPayment();
    return statusMatches && paymentMatches;
  }));

  protected updateStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value as 'ALL' | CustomerOrderStatus);
  }

  protected updatePayment(event: Event): void {
    this.selectedPayment.set((event.target as HTMLSelectElement).value as 'ALL' | PaymentStatus);
  }

  protected clearFilters(): void {
    this.selectedStatus.set('ALL');
    this.selectedPayment.set('ALL');
  }
}
