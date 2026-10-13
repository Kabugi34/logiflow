import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LogisticsRoutePoint } from '../../../../core/logistics/logistics.models';
import { LogisticsService } from '../../../../core/logistics/logistics.service';
import { LogisticsRouteMapComponent } from '../../../../shared/maps/logistics-route-map.component';
import { DistributorOrderService } from '../../orders/order.service';

@Component({
  selector: 'app-distributor-logistics',
  standalone: true,
  imports: [CommonModule, RouterLink, LogisticsRouteMapComponent],
  templateUrl: './distributor-logistics.component.html'
})
export class DistributorLogisticsComponent {
  private readonly logisticsService = inject(LogisticsService);
  private readonly orderService = inject(DistributorOrderService);

  readonly inboundOrders = computed(() =>
    this.logisticsService.inboundOrders().filter(order => order.status !== 'DELIVERED')
  );

  readonly outboundOrders = computed(() =>
    this.orderService.activeOrders().filter(order => order.status !== 'COMPLETED').slice(0, 4)
  );

  readonly outboundShipments = computed(() => this.orderService.groupOrdersByRoute());

  readonly selectedInboundId = signal('PO-2026-081');
  readonly selectedOutboundId = signal('SHP-001');

  readonly selectedInbound = computed(
    () =>
      this.inboundOrders().find(order => order.id === this.selectedInboundId()) ?? this.inboundOrders()[0]
  );

  readonly selectedOutboundShipment = computed(
    () => this.outboundShipments().find(shipment => shipment.id === this.selectedOutboundId()) ?? this.outboundShipments()[0]
  );

  readonly selectedOutbound = computed(
    () => this.selectedOutboundShipment()?.orders[0] ?? this.outboundOrders().find(order => order.id === this.selectedOutboundId()) ?? this.outboundOrders()[0]
  );

  readonly inboundRoute = computed(() => this.selectedInbound()?.route?.length
    ? this.selectedInbound()!.route
    : this.routeForLocation('Nairobi Distribution Centre'));

  readonly outboundRoute = computed(() => this.routeForLocation(this.selectedOutbound()?.destinationName ?? 'Westlands Distribution Hub'));

  readonly inboundShipmentsInMotion = computed(
    () => this.inboundOrders().filter(order => order.status === 'IN_TRANSIT' || order.status === 'PROCESSING').length
  );

  readonly outboundDeliveriesInMotion = computed(
    () => this.outboundShipments().filter(shipment => shipment.status === 'IN_TRANSIT' || shipment.status === 'REROUTED').length
  );

  readonly onTimeInboundRate = computed(() => {
    const orders = this.inboundOrders();
    if (!orders.length) return 0;
    const onTime = orders.filter(order => order.status === 'DELIVERED' || order.status === 'IN_TRANSIT').length;
    return Math.round((onTime / orders.length) * 100);
  });

  selectInbound(id: string): void {
    this.selectedInboundId.set(id);
  }

  selectOutbound(id: string): void {
    this.selectedOutboundId.set(id);
  }

  inboundStatusClass(status: string): string {
    switch (status) {
      case 'IN_TRANSIT':
        return 'border border-blue-200 bg-blue-50 text-blue-700';
      case 'PROCESSING':
        return 'border border-amber-200 bg-amber-50 text-amber-700';
      case 'PENDING':
        return 'border border-slate-200 bg-slate-100 text-slate-700';
      case 'DELIVERED':
        return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
      default:
        return 'border border-slate-200 bg-slate-100 text-slate-700';
    }
  }

  outboundStatusClass(status: string): string {
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

  private routeForLocation(location: string): LogisticsRoutePoint[] {
    const text = location.toLowerCase();

    if (text.includes('mombasa') || text.includes('coastline')) {
      return [
        { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi Distribution Centre' },
        { latitude: -0.7172, longitude: 36.431, label: 'Naivasha Checkpoint' },
        { latitude: -3.396, longitude: 38.556, label: 'Voi Checkpoint' },
        { latitude: -4.0435, longitude: 39.6682, label: 'Mombasa Bay' }
      ];
    }

    if (text.includes('kisumu') || text.includes('eldoret')) {
      return [
        { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi Distribution Centre' },
        { latitude: -0.3031, longitude: 36.0800, label: 'Nakuru Cross Dock' },
        { latitude: -0.0917, longitude: 34.7680, label: 'Kisumu Hub' }
      ];
    }

    return [
      { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi Distribution Centre' },
      { latitude: -1.278, longitude: 36.817, label: 'Westlands Hub' },
      { latitude: -1.2864, longitude: 36.8172, label: 'Final delivery stop' }
    ];
  }
}
