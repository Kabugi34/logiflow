import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LogisticsService } from '../../../../../core/logistics/logistics.service';
import { LogisticsRouteMapComponent } from '../../../../../shared/maps/logistics-route-map.component';
import { ManufacturerShipment } from '../../shipment.models';

@Component({
  selector: 'app-shipment-route-map',
  imports: [LogisticsRouteMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shipment-route-map.component.html'
})
export class ShipmentRouteMapComponent {
  readonly shipment = input.required<ManufacturerShipment>();
  private readonly logisticsService = inject(LogisticsService);
  protected readonly inboundOrder = computed(() => this.logisticsService.findInboundOrder(this.shipment().poReference));
  protected readonly route = computed(() => this.inboundOrder()?.route ?? this.shipment().route);
  protected readonly currentIndex = computed(() => {
    const sharedIndex = this.inboundOrder()?.currentRouteIndex;
    if (sharedIndex !== undefined) return sharedIndex;
    return this.shipment().status === 'DELIVERED' ? this.route().length - 1 : Math.min(1, this.route().length - 1);
  });
}