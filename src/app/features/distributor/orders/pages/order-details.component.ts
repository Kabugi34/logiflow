import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DistributorInventoryService } from '../../inventory/inventory.service';
import { DistributorOrderService } from '../order.service';
import { CustomerOrderLine } from '../order.models';
import { OrderBadgeComponent } from '../components/order-badge/order-badge.component';
import { PaymentInitiationComponent } from '../../../payments/payment-initiation.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { PaymentStatus } from '../../../../core/models/payment.model';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    OrderBadgeComponent,
    PaymentInitiationComponent,
  ],
  templateUrl: './order-details.component.html',
})
export class OrderDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly inventoryService = inject(DistributorInventoryService);
  protected readonly orderService = inject(DistributorOrderService);
  private readonly auth = inject(AuthService);
  private readonly routeParams = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly order = computed(() =>
    this.orderService.findById(this.routeParams().get('id') ?? ''),
  );
  protected readonly hasStockShortage = computed(
    () => this.order()?.lines.some((line) => this.shortfall(line) > 0) ?? false,
  );
  protected readonly errorMessage = signal('');
  protected readonly canInitiatePayment = computed(
    () => this.auth.hasRole('DISTRIBUTOR_ADMIN') || this.auth.hasRole('DISTRIBUTOR_STAFF'),
  );
  private checkedPaymentOrderId = '';

  constructor() {
    effect(() => {
      const current = this.order();
      if (!current || this.checkedPaymentOrderId === current.id) return;
      this.checkedPaymentOrderId = current.id;
      this.orderService.getPaymentStatus(current.id).subscribe({
        next: (result) => this.orderService.recordPaymentStatus(current.id, result.status),
        error: () => this.errorMessage.set('Payment status could not be verified from the server.'),
      });
    });
  }

  protected shortfall(line: CustomerOrderLine): number {
    const onHand = this.inventoryService.findBySku(line.sku)?.onHand ?? 0;
    return Math.max(0, line.quantity - onHand);
  }

  protected updatePaymentStatus(orderId: string, status: PaymentStatus): void {
    this.orderService.recordPaymentStatus(orderId, status);
  }

  protected canRequestPayment(order: NonNullable<ReturnType<typeof this.order>>): boolean {
    return (
      this.canInitiatePayment() &&
      !['DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED'].includes(order.status)
    );
  }
}
