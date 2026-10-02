import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ManufacturerPurchaseOrderService } from '../../purchase-orders/purchase-order.service';
import { ManufacturerFleetService } from '../../fleet/fleet.service';
import { ManufacturerShipmentService, NewShipment } from '../shipment.service';
import { ShipmentStatus } from '../shipment.models';

@Component({
  selector: 'app-shipment-list',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './shipment-list.component.html'
})
export class ShipmentListComponent {
  private readonly shipmentService = inject(ManufacturerShipmentService);
  private readonly purchaseOrderService = inject(ManufacturerPurchaseOrderService);
  private readonly fleetService = inject(ManufacturerFleetService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly selectedStatus = signal('ACTIVE');
  protected readonly isAllocationOpen = signal(false);
  protected readonly allocationError = signal('');
  protected readonly orders = this.purchaseOrderService.orders;
  protected readonly availableDrivers = computed(() => this.fleetService.drivers().filter(driver => {
    const vehicle = driver.vehicleId ? this.fleetService.findVehicle(driver.vehicleId) : undefined;
    return driver.status === 'STANDBY' && driver.currentTripId === null &&
      vehicle?.assignedDriverId === driver.id && this.fleetService.vehicleStatus(vehicle) === 'STANDBY' && vehicle.currentTripId === null;
  }));
  protected readonly shipments = computed(() => this.shipmentService.shipments().filter(shipment => {
    const status = this.selectedStatus();
    return status === 'ALL' || (status === 'ACTIVE' ? shipment.status !== 'DELIVERED' : shipment.status === status);
  }));
  protected readonly form = this.formBuilder.nonNullable.group({
    poReference: ['PO-2026-981', Validators.required],
    destination: ['', [Validators.required, Validators.maxLength(100)]],
    freightDetails: ['', [Validators.required, Validators.maxLength(100)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    driverId: ['', Validators.required],
    tripId: ['TRP-8017', [Validators.required, Validators.maxLength(24)]]
  });

  protected setStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
  }

  protected openAllocation(): void {
    this.allocationError.set('');
    this.form.reset({ poReference: 'PO-2026-981', destination: '', freightDetails: '', quantity: 1, driverId: '', tripId: 'TRP-8017' });
    this.updateOrderDefaults();
    this.isAllocationOpen.set(true);
  }

  protected updateOrderDefaults(): void {
    const order = this.purchaseOrderService.findById(this.form.controls.poReference.value);
    if (!order) return;
    this.form.patchValue({
      destination: order.destinationHub,
      freightDetails: order.lines.map(line => line.productName).join(', '),
      quantity: order.lines.reduce((total, line) => total + line.requestedQuantity, 0)
    });
  }

  protected closeAllocation(): void {
    this.isAllocationOpen.set(false);
  }

  protected allocate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const order = this.purchaseOrderService.findById(this.form.controls.poReference.value);
    if (!order) {
      this.allocationError.set('Select a valid purchase order.');
      return;
    }
    const driver = this.fleetService.findDriver(this.form.controls.driverId.value);
    const vehicle = driver?.vehicleId ? this.fleetService.findVehicle(driver.vehicleId) : undefined;
    if (!driver || !vehicle) {
      this.allocationError.set('Choose a standby driver with an assigned vehicle.');
      return;
    }

    const tripId = this.form.controls.tripId.value;
    try {
      if (!this.fleetService.dispatchDriver(driver.id, tripId)) {
        this.allocationError.set('That driver or vehicle is no longer available for dispatch.');
        return;
      }

      const shipmentId = this.shipmentService.create({
        poReference: this.form.controls.poReference.value,
        destination: this.form.controls.destination.value,
        freightDetails: this.form.controls.freightDetails.value,
        quantity: this.form.controls.quantity.value,
        assignedDriver: driver.name,
        vehicle: `${vehicle.type} (Plate: ${vehicle.plate})`,
        tripId
      });
      this.isAllocationOpen.set(false);
      void this.router.navigate(['/manufacturer/shipments', shipmentId], { queryParamsHandling: 'preserve' });
    } catch {
      this.fleetService.completeTrip(tripId);
      this.allocationError.set('Shipment could not be allocated. Please try again.');
    }
  }

  protected driverVehicleLabel(driverId: string): string {
    const driver = this.fleetService.findDriver(driverId);
    const vehicle = driver?.vehicleId ? this.fleetService.findVehicle(driver.vehicleId) : undefined;
    return vehicle ? `${vehicle.plate} · ${vehicle.type}` : 'No assigned vehicle';
  }

  protected statusLabel(status: ShipmentStatus): string {
    return status === 'BORDER_HOLD' ? 'BORDER HOLD' : status === 'IN_TRANSIT' ? 'IN TRANSIT' : 'DELIVERED';
  }

  protected statusClass(status: ShipmentStatus): string {
    return status === 'BORDER_HOLD' ? 'border-red-200 bg-red-50 text-red-700' : status === 'IN_TRANSIT' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
}
