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
      case 'READY_FOR_DISPATCH': return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'IN_TRANSIT': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'DELIVERED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'RECEIVED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'CANCELLED': return 'border-slate-200 bg-slate-50 text-slate-600';
      case 'BORDER_HOLD': return 'border-red-200 bg-red-50 text-red-700';
      case 'UNKNOWN': return 'border-slate-200 bg-slate-50 text-slate-600';
    }
  }

  protected statusLabel(): string {
    switch (this.status()) {
      case 'READY_FOR_DISPATCH': return 'READY FOR DISPATCH';
      case 'BORDER_HOLD': return 'BORDER HOLD';
      case 'IN_TRANSIT': return 'IN TRANSIT';
      case 'DELIVERED': return 'DELIVERED';
      case 'RECEIVED': return 'RECEIVED';
      case 'CANCELLED': return 'CANCELLED';
      case 'UNKNOWN': return 'UNKNOWN STATUS';
    }
  }
}
