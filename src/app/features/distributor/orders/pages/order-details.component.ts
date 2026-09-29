import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DistributorFleetService } from '../../fleet/fleet.service';
import { DistributorInventoryService } from '../../inventory/inventory.service';
import { DistributorOrderService } from '../order.service';
import { CustomerOrderLine } from '../order.models';
import { OrderBadgeComponent } from '../components/order-badge/order-badge.component';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, OrderBadgeComponent],
  templateUrl: './order-details.component.html'
})
export class OrderDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly inventoryService = inject(DistributorInventoryService);
  protected readonly orderService = inject(DistributorOrderService);
  protected readonly fleetService = inject(DistributorFleetService);
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly order = computed(() => this.orderService.findById(this.routeParams().get('id') ?? ''));
  protected readonly assignedVehicle = computed(() => this.fleetService.findVehicle(this.order()?.vehicleId));
  protected readonly assignedDriver = computed(() => this.fleetService.findDriver(this.order()?.driverId));
  protected readonly selectedVehicleId = linkedSignal(() => this.fleetService.availableVehicles()[0]?.id ?? '');
  protected readonly selectedDriverId = linkedSignal(() => this.fleetService.standbyDrivers()[0]?.id ?? '');
  protected readonly hasStockShortage = computed(() => this.order()?.lines.some(line => this.shortfall(line) > 0) ?? false);
  protected readonly errorMessage = signal('');

  protected shortfall(line: CustomerOrderLine): number {
    const onHand = this.inventoryService.findBySku(line.sku)?.onHand ?? 0;
    return Math.max(0, line.quantity - onHand);
  }

  protected updateVehicle(event: Event): void {
    this.selectedVehicleId.set((event.target as HTMLSelectElement).value);
  }

  protected updateDriver(event: Event): void {
    this.selectedDriverId.set((event.target as HTMLSelectElement).value);
  }

  protected dispatch(): void {
    const order = this.order();
    if (!order) return;
    this.errorMessage.set('');
    try {
      this.orderService.dispatch(order.id, this.selectedVehicleId(), this.selectedDriverId());
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to dispatch this order.');
    }
  }

  protected confirmDelivery(): void {
    const order = this.order();
    if (order) this.orderService.confirmDelivery(order.id);
  }

  protected markPaid(): void {
    const order = this.order();
    if (order) this.orderService.markPaid(order.id);
  }
}
