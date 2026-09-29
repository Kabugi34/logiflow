import { Component, input } from '@angular/core';
import { ShipmentStatus } from '../../shipment.models';

@Component({
  selector: 'app-shipment-status',
  standalone: true,
  template: '<span class="inline-flex whitespace-nowrap rounded border px-2 py-1 text-[9px] font-medium" [class]="statusClass()">{{ statusLabel() }}</span>'
})
export class ShipmentStatusComponent {
  readonly status = input.required<ShipmentStatus>();

  protected statusClass(): string {
    switch (this.status()) {
      case 'IN_TRANSIT': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'DELIVERED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'BORDER_HOLD': return 'border-red-200 bg-red-50 text-red-700';
    }
  }

  protected statusLabel(): string {
    return this.status() === 'BORDER_HOLD' ? 'BORDER HOLD' : this.status() === 'IN_TRANSIT' ? 'IN TRANSIT' : 'DELIVERED';
  }
}
