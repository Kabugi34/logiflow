import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DistributorInventoryService } from '../../inventory/inventory.service';
import { DistributorOrderService } from '../order.service';
import { CustomerOrderLine } from '../order.models';
import { OrderBadgeComponent } from '../components/order-badge/order-badge.component';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, OrderBadgeComponent],
  templateUrl: './order-details.component.html',
})
export class OrderDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly inventoryService = inject(DistributorInventoryService);
  protected readonly orderService = inject(DistributorOrderService);
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
  private checkedPaymentOrderId = '';

  constructor() {
    effect(() => {
      const current = this.order();
      if (!current || this.checkedPaymentOrderId === current.id) return;
      this.checkedPaymentOrderId = current.id;
      this.orderService
        .getPaymentStatus(current.id)
        .subscribe({
          next: (result) => this.orderService.recordPaymentStatus(current.id, result.status),
        });
    });
  }

  protected shortfall(line: CustomerOrderLine): number {
    const onHand = this.inventoryService.findBySku(line.sku)?.onHand ?? 0;
    return Math.max(0, line.quantity - onHand);
  }

}
