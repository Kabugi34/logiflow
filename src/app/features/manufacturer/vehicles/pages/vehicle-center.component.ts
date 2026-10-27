import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FleetDriver, FleetVehicle, VehicleStatus } from '../../fleet/fleet.models';
import { ManufacturerFleetService } from '../../fleet/fleet.service';
import { trimmedRequired } from '../../../../core/forms/form-validators';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-vehicle-center',
  standalone: true,
  imports: [FormValidationSummaryComponent, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './vehicle-center.component.html',
})
export class VehicleCenterComponent {
  private readonly fleetService = inject(ManufacturerFleetService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly vehicles = computed(() =>
    this.fleetService.vehicles().map((vehicle) => ({
      ...vehicle,
      serviceStatus: this.fleetService.vehicleStatus(vehicle),
    })),
  );
  protected readonly drivers = this.fleetService.drivers;
  protected readonly metrics = this.fleetService.vehicleMetrics;
  protected readonly selectedStatus = signal('ALL');
  protected readonly isRegisterOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly assignmentMessage = signal('');
  protected readonly saving = signal(false);
  protected readonly filteredVehicles = computed(() =>
    this.vehicles().filter(
      (vehicle) =>
        this.selectedStatus() === 'ALL' ||
        this.fleetService.vehicleStatus(vehicle) === this.selectedStatus(),
    ),
  );
  protected readonly form = this.formBuilder.nonNullable.group({
    plate: [
      '',
      [trimmedRequired, Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9 -]+$/)],
    ],
    type: ['', [trimmedRequired, Validators.maxLength(80)]],
    maxWeightCapacity: [26000, [Validators.required, Validators.min(1)]],
  });

  protected updateStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
  }

  protected openRegisterDialog(): void {
    this.form.reset({ plate: '', type: '', maxWeightCapacity: 26000 });
    this.formError.set('');
    this.isRegisterOpen.set(true);
  }

  protected closeRegisterDialog(): void {
    this.isRegisterOpen.set(false);
  }

  protected registerVehicle(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.fleetService.createVehicleApi(this.form.getRawValue()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.selectedStatus.set('ALL'); this.isRegisterOpen.set(false); },
      error: error => this.formError.set(error?.error?.message ?? 'Unable to register vehicle.')
    });
  }

  protected availableDrivers(vehicleId: string): FleetDriver[] {
    const vehicle = this.vehicles().find((record) => record.id === vehicleId);
    if (!vehicle) return [];
    if (vehicle.assignedDriverId) {
      const assignedDriver = this.drivers().find(
        (driver) => driver.id === vehicle.assignedDriverId,
      );
      return assignedDriver ? [assignedDriver] : [];
    }
    if (this.fleetService.vehicleStatus(vehicle) !== 'IDLE') return [];
    return this.drivers().filter(
      (driver) =>
        driver.vehicleId === null &&
        driver.currentTripId === null &&
        driver.accountStatus === 'ACTIVE' &&
        driver.operationalStatus === 'AVAILABLE',
    );
  }

  protected assignedDriverName(driverId: string | null): string {
    return this.drivers().find((driver) => driver.id === driverId)?.name ?? 'Unassigned';
  }

  protected vehicleStatus(vehicle: FleetVehicle): VehicleStatus {
    return this.fleetService.vehicleStatus(vehicle);
  }

  protected assignDriver(vehicleId: string, event: Event): void {
    const driverId = (event.target as HTMLSelectElement).value;
    this.fleetService.assignDriverApi(vehicleId, driverId || null).subscribe({
      next: () => this.assignmentMessage.set('Vehicle assignment updated.'),
      error: error => this.assignmentMessage.set(error?.error?.message ?? 'Vehicle assignment could not be saved.')
    });
  }

  protected updateCondition(vehicleId: string, event: Event): void {
    const condition = (event.target as HTMLSelectElement).value as
      'READY' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
    this.fleetService.updateVehicleStatusApi(vehicleId, condition).subscribe({
      next: () => this.assignmentMessage.set('Vehicle service status updated.'),
      error: error => this.assignmentMessage.set(error?.error?.message ?? 'Vehicle service status could not be updated.')
    });
  }

  protected statusLabel(status: VehicleStatus): string {
    return status === 'OUT_OF_SERVICE' ? 'OUT OF SERVICE' : status;
  }

  protected statusClass(status: VehicleStatus): string {
    switch (status) {
      case 'ACTIVE':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'STANDBY':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'MAINTENANCE':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'IDLE':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'OUT_OF_SERVICE':
        return 'border-red-200 bg-red-50 text-red-700';
    }
  }
}
