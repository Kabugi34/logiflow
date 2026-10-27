import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ManufacturerShipmentService } from '../shipment.service';
import { ShipmentStatusComponent } from '../components/shipment-status/shipment-status.component';
import { ShipmentRouteMapComponent } from '../components/shipment-route-map/shipment-route-map.component';
import { finalize } from 'rxjs';

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
  protected readonly busy = signal(false);
  protected readonly feedback = signal('');

  protected advanceStatus(): void {
    const shipment = this.shipment();
    if (!shipment || this.busy()) return;
    const status = shipment.status === 'IN_TRANSIT' ? 'DELIVERED' : shipment.status === 'BORDER_HOLD' ? 'IN_TRANSIT' : null;
    if (!status) return;
    this.feedback.set('');
    this.busy.set(true);
    this.shipmentService.updateStatus(shipment.id, status).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.feedback.set('Shipment status updated.'); this.shipmentService.refresh(); },
      error: error => this.feedback.set(error?.error?.message ?? 'Shipment status could not be updated.')
    });
  }

  protected actionLabel(status: string): string {
    return status === 'BORDER_HOLD' ? 'Release Documentation Hold' : 'Confirm Delivery';
  }
}
