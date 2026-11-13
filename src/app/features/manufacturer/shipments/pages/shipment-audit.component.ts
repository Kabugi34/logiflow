import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ManufacturerShipmentService } from '../shipment.service';
import { ShipmentStatusComponent } from '../components/shipment-status/shipment-status.component';
import { ShipmentRouteMapComponent } from '../components/shipment-route-map/shipment-route-map.component';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-shipment-audit',
  standalone: true,
  imports: [RouterLink, ShipmentStatusComponent, ShipmentRouteMapComponent],
  templateUrl: './shipment-audit.component.html'
})
export class ShipmentAuditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly shipmentService = inject(ManufacturerShipmentService);
  private readonly auth = inject(AuthService);
  protected readonly canCancel = this.auth.hasRole('MANUFACTURER_ADMIN');
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly shipment = computed(() => this.shipmentService.findById(this.routeParams().get('id') ?? ''));
  protected readonly busy = signal(false);
  protected readonly feedback = signal('');

  protected advanceStatus(): void {
    const shipment = this.shipment();
    if (!shipment || this.busy()) return;
    const status =
      shipment.status === 'READY_FOR_DISPATCH'
        ? 'IN_TRANSIT'
        : shipment.status === 'IN_TRANSIT'
        ? 'DELIVERED'
          : null;
    if (!status) return;
    this.feedback.set('');
    this.busy.set(true);
    this.shipmentService.updateStatus(shipment.id, status).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.feedback.set('Shipment status updated.'); this.shipmentService.refresh(); },
      error: error => this.feedback.set(error?.error?.message ?? 'Shipment status could not be updated.')
    });
  }

  protected actionLabel(status: 'READY_FOR_DISPATCH' | 'IN_TRANSIT'): string {
    return status === 'READY_FOR_DISPATCH' ? 'Dispatch Shipment' : 'Confirm Delivery';
  }

  protected cancelShipment(): void {
    const shipment = this.shipment();
    if (!shipment || !this.canCancel || this.busy()) return;
    const note = globalThis.prompt('Provide a cancellation reason:')?.trim();
    if (!note) return;
    this.busy.set(true);
    this.feedback.set('');
    this.shipmentService.updateStatus(shipment.id, 'CANCELLED', note)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => { this.feedback.set('Shipment cancelled.'); this.shipmentService.refresh(); },
        error: error => this.feedback.set(error?.error?.message ?? 'Shipment could not be cancelled.'),
      });
  }
}
