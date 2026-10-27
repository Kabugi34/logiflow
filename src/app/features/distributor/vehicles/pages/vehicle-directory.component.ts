import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DistributorFleetService } from '../../fleet/fleet.service';
import { VehicleStatus } from '../../fleet/fleet.models';
import { trimmedRequired } from '../../../../core/forms/form-validators';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-distributor-vehicle-directory',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './vehicle-directory.component.html',
})
export class VehicleDirectoryComponent {
  private readonly fleet = inject(DistributorFleetService);
  private readonly fb = inject(FormBuilder);
  protected readonly vehicles = this.fleet.vehicles;
  protected readonly status = signal<'ALL' | VehicleStatus>('ALL');
  protected readonly filter = signal('');
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly dialog = signal(false);
  protected readonly saving = signal(false);
  protected readonly counts = computed(() => ({
    total: this.vehicles().length,
    available: this.vehicles().filter((v) => v.status === 'AVAILABLE').length,
    onTrip: this.vehicles().filter((v) => v.status === 'ON_TRIP').length,
    maintenance: this.vehicles().filter(
      (v) => v.status === 'MAINTENANCE' || v.status === 'OUT_OF_SERVICE',
    ).length,
  }));
  protected readonly filtered = computed(() =>
    this.vehicles().filter(
      (v) =>
        (this.status() === 'ALL' || v.status === this.status()) &&
        (!this.filter() ||
          [v.plate, v.model].some((x) => x.toLowerCase().includes(this.filter().toLowerCase()))),
    ),
  );
  protected readonly form = this.fb.nonNullable.group({
    model: ['', [trimmedRequired, Validators.maxLength(80)]],
    plate: [
      '',
      [trimmedRequired, Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9 -]+$/)],
    ],
  });
  protected open(): void {
    this.form.reset({ model: '', plate: '' });
    this.error.set('');
    this.dialog.set(true);
  }
  protected add(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.fleet.createVehicle(this.form.getRawValue()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: vehicle => { this.dialog.set(false); this.status.set('ALL'); this.filter.set(''); this.message.set(`${vehicle.plate} added to the fleet.`); },
      error: error => this.error.set(error?.error?.message ?? 'Vehicle could not be created.')
    });
  }
  protected update(vehicleId: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value as
      'AVAILABLE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
    this.fleet.setVehicleStatus(vehicleId, value).subscribe({
      next: () => this.message.set('Vehicle status updated.'),
      error: error => this.message.set(error?.error?.message ?? 'Vehicle status could not be updated.')
    });
  }
  protected search(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }
  protected changeFilter(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as 'ALL' | VehicleStatus);
  }
}
