import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WarehouseCardComponent } from '../components/warehouse-card/warehouse-card.component';
import { WarehouseDetailsComponent } from '../components/warehouse-details/warehouse-details.component';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';
import { ManufacturerWarehouseService } from '../warehouse.service';
import { personName, trimmedRequired } from '../../../../core/forms/form-validators';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-warehouse-overview',
  standalone: true,
  imports: [
    FormValidationSummaryComponent,
    LoadingSkeletonComponent,
    ReactiveFormsModule,
    RouterLink,
    WarehouseCardComponent,
    WarehouseDetailsComponent,
  ],
  templateUrl: './warehouse-overview.component.html',
})
export class WarehouseOverviewComponent {
  protected readonly warehouseService = inject(ManufacturerWarehouseService);
  private readonly fb = inject(FormBuilder);
  protected readonly warehouses = this.warehouseService.warehouses;
  protected readonly selectedWarehouseId = signal<string | null>(null);
  protected readonly selectedWarehouse = computed(() => {
    const id = this.selectedWarehouseId();
    return id ? (this.warehouseService.findById(id) ?? null) : null;
  });
  protected readonly createOpen = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly loading = this.warehouseService.loading;
  protected readonly form = this.fb.nonNullable.group({
    code: ['', [trimmedRequired, Validators.maxLength(24), Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', [trimmedRequired, Validators.maxLength(80)]],
    address: ['', [trimmedRequired, Validators.maxLength(120)]],
    city: ['', [trimmedRequired, personName, Validators.maxLength(60)]],
    postalCode: ['', [Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9 -]*$/)]],
    siteManager: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
  });

  protected openCreate(): void {
    this.form.reset({ code: '', name: '', address: '', city: '', postalCode: '', siteManager: '' });
    this.error.set('');
    this.createOpen.set(true);
  }
  protected createWarehouse(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);
    this.warehouseService.createWarehouse(this.form.getRawValue()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: row => {
        this.warehouseService.refresh();
        this.selectedWarehouseId.set(row.id);
        this.createOpen.set(false);
        this.form.reset({ code: '', name: '', address: '', city: '', postalCode: '', siteManager: '' });
        this.message.set('Warehouse created.');
      },
      error: error => this.error.set(error?.error?.message ?? 'Warehouse could not be created. Check your organization role and try again.')
    });
  }
  protected toggleSelectedStatus(): void {
    const id = this.selectedWarehouseId();
    const warehouse = id ? this.warehouseService.findById(id) : undefined;
    if (!warehouse || this.saving()) return;
    this.saving.set(true);
    this.warehouseService.updateStatus(id!, warehouse.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      .pipe(finalize(() => this.saving.set(false))).subscribe({
        next: () => { this.warehouseService.refresh(); this.message.set('Warehouse status updated.'); },
        error: error => this.error.set(error?.error?.message ?? 'Warehouse status could not be updated.')
      });
  }

  protected selectWarehouse(id: string): void {
    this.selectedWarehouseId.set(id);
  }

  protected closeDetails(): void {
    this.selectedWarehouseId.set(null);
  }
}
