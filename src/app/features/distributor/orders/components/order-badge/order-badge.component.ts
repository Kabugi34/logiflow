import { Component, input } from '@angular/core';
import { OrderBadgeValue } from '../../order.models';

@Component({
  selector: 'app-order-badge',
  standalone: true,
  template: '<span class="inline-flex whitespace-nowrap rounded border px-2 py-1 text-[9px] font-medium" [class]="badgeClass()">{{ label() || value().replace(\'_\', \' \') }}</span>'
})
export class OrderBadgeComponent {
  readonly value = input.required<OrderBadgeValue>();
  readonly label = input('');

  protected badgeClass(): string {
    switch (this.value()) {
      case 'PAID':
      case 'COMPLETED':
      case 'DELIVERED':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'IN_TRANSIT':
      case 'ON_ROUTE':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'HOLD':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'PENDING':
      case 'PREPARING':
      case 'REROUTED':
      case 'UNASSIGNED':
        return 'border-amber-200 bg-amber-50 text-amber-700';
    }
  }
}
