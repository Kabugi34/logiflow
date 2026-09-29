import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderBadgeComponent } from '../../../orders/components/order-badge/order-badge.component';
import { DashboardCustomerOrder } from '../../dashboard.models';

@Component({
  selector: 'app-active-customer-orders',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, OrderBadgeComponent],
  templateUrl: './active-customer-orders.component.html'
})
export class ActiveCustomerOrdersComponent {
  readonly orders = input.required<DashboardCustomerOrder[]>();
  protected readonly awaitingFulfillment = computed(() => this.orders().filter(order => order.status === 'PREPARING').length);
}
