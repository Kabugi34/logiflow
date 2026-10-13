import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DistributorCustomerService } from '../customer.service';
import { DistributorOrderService } from '../../orders/order.service';
import { DistributorFleetService } from '../../fleet/fleet.service';

@Component({
  selector: 'app-customer-directory',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './customer-directory.component.html'
})
export class CustomerDirectoryComponent {
  protected readonly customerService = inject(DistributorCustomerService);
  protected readonly orderService = inject(DistributorOrderService);
  protected readonly fleetService = inject(DistributorFleetService);

  protected readonly customers = computed(() =>
    this.customerService.customers().map(customer => {
      const orders = this.orderService.orders().filter(order => order.customerId === customer.id);
      const activeOrders = orders.filter(order => order.status !== 'COMPLETED');
      const paidOrders = orders.filter(order => order.paymentStatus === 'PAID');
      const latestOrder = [...orders].sort((left, right) =>
        new Date(right.orderDate).getTime() - new Date(left.orderDate).getTime()
      )[0];
      const activeDelivery = orders.find(order => order.status === 'IN_TRANSIT' || order.status === 'REROUTED');
      const vehicle = activeDelivery ? this.fleetService.findVehicle(activeDelivery.vehicleId ?? '') : undefined;
      const driver = activeDelivery ? this.fleetService.findDriver(activeDelivery.driverId ?? '') : undefined;
      const shipment = activeDelivery ? this.orderService.findShipmentForOrder(activeDelivery.id) : undefined;

      return {
        ...customer,
        orders,
        activeOrders,
        paidOrders,
        latestOrder,
        activeDelivery,
        vehicle,
        driver,
        shipment,
        orderCount: orders.length,
        paidRatio: orders.length ? Math.round((paidOrders.length / orders.length) * 100) : 0,
        totalValue: orders.reduce((sum, order) => sum + this.orderService.total(order), 0)
      };
    })
  );

  protected readonly selectedCustomerId = signal('');

  protected readonly selectedCustomer = computed(() => {
    const list = this.customers();
    if (!list.length) return undefined;
    return list.find(customer => customer.id === this.selectedCustomerId()) ?? list[0];
  });

  protected averagePaidRatio(): number {
    const customers = this.customers();
    if (!customers.length) return 0;
    return Math.round(customers.reduce((sum, customer) => sum + customer.paidRatio, 0) / customers.length);
  }

  protected paymentBadgeClass(status: string): string {
    return status === 'PAID'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border border-amber-200 bg-amber-50 text-amber-700';
  }

  protected orderStatusClass(status: string): string {
    switch (status) {
      case 'IN_TRANSIT':
        return 'border border-blue-200 bg-blue-50 text-blue-700';
      case 'REROUTED':
        return 'border border-orange-200 bg-orange-50 text-orange-700';
      case 'PREPARING':
        return 'border border-slate-200 bg-slate-100 text-slate-700';
      case 'COMPLETED':
        return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
      default:
        return 'border border-slate-200 bg-slate-100 text-slate-700';
    }
  }

  protected selectCustomer(id: string): void {
    this.selectedCustomerId.set(id);
  }
}
