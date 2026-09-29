import { Component, input } from '@angular/core';
import { PurchaseOrderStatus } from '../../purchase-order.models';

@Component({
  selector: 'app-purchase-order-status',
  standalone: true,
  template: '<span class="inline-flex rounded border px-2 py-1 text-[9px] font-medium" [class]="statusClass()">{{ statusLabel() }}</span>'
})
export class PurchaseOrderStatusComponent {
  readonly status = input.required<PurchaseOrderStatus>();

  protected statusClass(): string {
    switch (this.status()) {
      case 'PENDING': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'ACCEPTED': return 'border-slate-200 bg-slate-50 text-slate-600';
      case 'REJECTED': return 'border-red-200 bg-red-50 text-red-700';
      case 'FULFILLED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
  }

  protected statusLabel(): string {
    return this.status();
  }
}
