import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DriverStatus } from '../../fleet/fleet.models';
import { ManufacturerFleetService } from '../../fleet/fleet.service';

@Component({
  selector: 'app-driver-directory',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './driver-directory.component.html'
})
export class DriverDirectoryComponent {
  private readonly fleetService = inject(ManufacturerFleetService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly drivers = this.fleetService.drivers;
  protected readonly metrics = this.fleetService.driverMetrics;
  protected readonly selectedDriverId = signal('DRV-001');
  protected readonly statusActionMessage = signal('');
  protected readonly selectedAssignmentVehicleId = signal('');
  protected readonly assignmentMessage = signal('');
  protected readonly searchTerm = signal('');
  protected readonly selectedStatus = signal('ALL');
  protected readonly isOnboardOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly selectedDriver = computed(() => this.fleetService.findDriver(this.selectedDriverId()));
  protected readonly selectedVehicle = computed(() => this.fleetService.getVehicleForDriver(this.selectedDriverId()));
  protected readonly availableVehicles = computed(() => this.fleetService.vehicles().filter(vehicle =>
    this.fleetService.vehicleStatus(vehicle) === 'IDLE' &&
    vehicle.currentTripId === null &&
    vehicle.assignedDriverId === null
  ));
  protected readonly pingedDriverId = this.fleetService.pingedDriverId;
  protected readonly filteredDrivers = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const status = this.selectedStatus();
    return this.drivers().filter(driver => {
      const matchesQuery = !query || [driver.name, driver.phone, driver.license].some(value => value.toLowerCase().includes(query));
      return matchesQuery && (status === 'ALL' || driver.status === status);
    });
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    phone: ['', [Validators.required, Validators.maxLength(32)]],
    license: ['', [Validators.required, Validators.maxLength(40)]],
    vehicleId: ['']
  });

  protected selectDriver(driverId: string): void {
    this.selectedDriverId.set(driverId);
    this.selectedAssignmentVehicleId.set(this.fleetService.findDriver(driverId)?.vehicleId ?? '');
    this.assignmentMessage.set('');
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
  }

  protected openOnboardDialog(): void {
    this.form.reset({ name: '', phone: '', license: '', vehicleId: '' });
    this.formError.set('');
    this.isOnboardOpen.set(true);
  }

  protected closeOnboardDialog(): void {
    this.isOnboardOpen.set(false);
  }

  protected onboardDriver(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      this.fleetService.onboardDriver(this.form.getRawValue());
      const newDriver = this.drivers().at(-1);
      if (newDriver) {
        this.selectedDriverId.set(newDriver.id);
        this.selectedAssignmentVehicleId.set(newDriver.vehicleId ?? '');
        this.selectedStatus.set('ALL');
        this.searchTerm.set('');
      }
      this.isOnboardOpen.set(false);
    } catch (error) {
      this.formError.set(error instanceof Error ? error.message : 'Unable to onboard driver.');
    }
  }

  protected pingDriver(): void {
    this.fleetService.pingDriver(this.selectedDriverId());
  }

  protected updateSelectedDriverStatus(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as DriverStatus;
    this.setSelectedDriverStatus(status);
  }

  protected approveSelectedDriver(): void {
    this.setSelectedDriverStatus('STANDBY');
  }

  protected suspendSelectedDriver(): void {
    this.setSelectedDriverStatus('SUSPENDED');
  }

  protected reinstateSelectedDriver(): void {
    this.setSelectedDriverStatus('STANDBY');
  }

  protected updateAssignmentVehicle(event: Event): void {
    this.selectedAssignmentVehicleId.set((event.target as HTMLSelectElement).value);
    this.assignmentMessage.set('');
  }

  protected assignSelectedVehicle(): void {
    const driver = this.selectedDriver();
    const vehicleId = this.selectedAssignmentVehicleId();
    if (!driver || !vehicleId) {
      this.assignmentMessage.set('Select an idle vehicle first.');
      return;
    }
    const assigned = this.fleetService.assignDriver(
      vehicleId,
      driver.id
    );
    this.assignmentMessage.set(assigned
      ? 'Vehicle assignment updated.'
      : 'Choose an unassigned driver and an idle vehicle.');
    if (assigned) this.selectedAssignmentVehicleId.set('');
  }

  protected unassignSelectedVehicle(): void {
    const vehicle = this.selectedVehicle();
    const unassigned = vehicle ? this.fleetService.assignDriver(vehicle.id, null) : false;
    this.assignmentMessage.set(unassigned ? 'Vehicle unassigned and returned to idle.' : 'This vehicle cannot be unassigned during an active trip.');
    if (unassigned) this.selectedAssignmentVehicleId.set('');
  }

  private setSelectedDriverStatus(status: DriverStatus): void {
    const updated = this.fleetService.updateDriverStatus(this.selectedDriverId(), status);
    this.statusActionMessage.set(updated
      ? `Driver status updated to ${this.statusLabel(status)}.`
      : 'This status change is not allowed while the driver is active or assigned to a trip.');
  }

  protected vehicleType(driverId: string): string {
    return this.fleetService.getVehicleForDriver(driverId)?.type ?? '—';
  }

  protected statusLabel(status: DriverStatus): string {
    return status === 'OFF_DUTY' ? 'OFF DUTY' : status;
  }

  protected statusClass(status: DriverStatus): string {
    switch (status) {
      case 'ACTIVE': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'STANDBY': return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'DELAYED': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'OFF_DUTY': return 'border-slate-200 bg-slate-100 text-slate-600';
      case 'INVITED': return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'SUSPENDED': return 'border-red-200 bg-red-50 text-red-700';
    }
  }
}
