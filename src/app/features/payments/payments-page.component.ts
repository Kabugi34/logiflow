import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PaymentOrderType, PaymentTransactionStatus } from '../../core/models/payment.model';
import { LoadingSkeletonComponent } from '../../shared/loading/loading-skeleton.component';
import { PaymentService } from './payment.service';

@Component({
  selector: 'app-payments-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, LoadingSkeletonComponent],
  templateUrl: './payments-page.component.html',
})
export class PaymentsPageComponent {
  protected readonly payments = inject(PaymentService);
  private readonly auth = inject(AuthService);
  protected readonly organizationType = computed(() => this.auth.user()?.organization.type ?? null);
  protected readonly isManufacturer = computed(() => this.organizationType() === 'MANUFACTURER');
  protected readonly orderType = signal<PaymentOrderType>('PURCHASE_ORDER');
  protected readonly statusFilter = signal<'ALL' | PaymentTransactionStatus>('ALL');
  protected readonly statuses: { value: 'ALL' | PaymentTransactionStatus; label: string }[] = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'SUCCEEDED', label: 'Successful' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'REVERSED', label: 'Reversed' },
    { value: 'REFUNDED', label: 'Refunded' },
    { value: 'UNKNOWN', label: 'Unknown' },
  ];
  protected readonly filteredTransactions = computed(() =>
    this.payments
      .transactions()
      .filter((payment) => this.statusFilter() === 'ALL' || payment.status === this.statusFilter()),
  );

  constructor() {
    if (this.organizationType() === 'MANUFACTURER' || this.organizationType() === 'DISTRIBUTOR') {
      this.payments.refreshTransactions(this.orderType());
    }
  }

  protected selectOrderType(orderType: PaymentOrderType): void {
    if (this.isManufacturer() && orderType !== 'PURCHASE_ORDER') return;
    this.orderType.set(orderType);
    this.statusFilter.set('ALL');
    this.payments.refreshTransactions(orderType);
  }

  protected updateStatus(event: Event): void {
    this.statusFilter.set(
      (event.target as HTMLSelectElement).value as 'ALL' | PaymentTransactionStatus,
    );
  }

  protected statusClass(status: PaymentTransactionStatus): string {
    switch (status) {
      case 'SUCCEEDED':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'PENDING':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'FAILED':
      case 'EXPIRED':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'REVERSED':
      case 'REFUNDED':
      case 'UNKNOWN':
        return 'border-slate-200 bg-slate-50 text-slate-600';
    }
  }
}
