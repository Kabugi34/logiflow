import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ManufacturerShipmentService } from '../shipment.service';
import { ShipmentStatusComponent } from '../components/shipment-status/shipment-status.component';
import { ShipmentRouteMapComponent } from '../components/shipment-route-map/shipment-route-map.component';

@Component({
  selector: 'app-shipment-audit',
  standalone: true,
  imports: [DecimalPipe, RouterLink, ShipmentStatusComponent, ShipmentRouteMapComponent],
  templateUrl: './shipment-audit.component.html'
})
export class ShipmentAuditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly shipmentService = inject(ManufacturerShipmentService);
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly shipment = computed(() => this.shipmentService.findById(this.routeParams().get('id') ?? ''));

  protected advanceStatus(): void {
    const shipment = this.shipment();
    if (!shipment) return;
    if (shipment.status === 'IN_TRANSIT') this.shipmentService.updateStatus(shipment.id, 'DELIVERED');
    if (shipment.status === 'BORDER_HOLD') this.shipmentService.updateStatus(shipment.id, 'IN_TRANSIT');
  }

  protected actionLabel(status: string): string {
    return status === 'BORDER_HOLD' ? 'Release Documentation Hold' : 'Confirm Delivery';
  }
}
