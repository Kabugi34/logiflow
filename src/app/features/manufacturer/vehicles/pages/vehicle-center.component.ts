import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FleetDriver, VehicleStatus } from '../../fleet/fleet.models';
import { ManufacturerFleetService } from '../../fleet/fleet.service';

@Component({
  selector: 'app-vehicle-center',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './vehicle-center.component.html'
})
export class VehicleCenterComponent {
  private readonly fleetService = inject(ManufacturerFleetService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly vehicles = this.fleetService.vehicles;
  protected readonly drivers = this.fleetService.drivers;
  protected readonly metrics = this.fleetService.vehicleMetrics;
  protected readonly selectedStatus = signal('ALL');
  protected readonly isRegisterOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly filteredVehicles = computed(() => this.vehicles().filter(vehicle => this.selectedStatus() === 'ALL' || vehicle.serviceStatus === this.selectedStatus()));
  protected readonly form = this.formBuilder.nonNullable.group({
    plate: ['', [Validators.required, Validators.maxLength(20)]],
    type: ['', [Validators.required, Validators.maxLength(80)]],
    maxWeightCapacity: [26000, [Validators.required, Validators.min(1)]]
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      this.fleetService.registerVehicle(this.form.getRawValue());
      this.selectedStatus.set('ALL');
      this.isRegisterOpen.set(false);
    } catch (error) {
      this.formError.set(error instanceof Error ? error.message : 'Unable to register vehicle.');
    }
  }

  protected availableDrivers(vehicleId: string): FleetDriver[] {
    return this.drivers().filter(driver =>
      driver.status !== 'INVITED' &&
      driver.status !== 'OFF_DUTY' &&
      (!driver.currentTripId || driver.vehicleId === vehicleId)
    );
  }

  protected assignDriver(vehicleId: string, event: Event): void {
    const driverId = (event.target as HTMLSelectElement).value;
    this.fleetService.assignDriver(vehicleId, driverId || null);
  }

  protected statusLabel(status: VehicleStatus): string {
    return status === 'OUT_OF_SERVICE' ? 'OUT OF SERVICE' : status;
  }

  protected statusClass(status: VehicleStatus): string {
    switch (status) {
      case 'ACTIVE': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'MAINTENANCE': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'IDLE': return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'OUT_OF_SERVICE': return 'border-red-200 bg-red-50 text-red-700';
    }
  }
}
