import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { DashboardPurchaseOrder } from '../../dashboard.models';

@Component({
  selector: 'app-pending-purchase-orders',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './pending-purchase-orders.component.html'
})
export class PendingPurchaseOrdersComponent {
  readonly purchaseOrders = input.required<DashboardPurchaseOrder[]>();
}
