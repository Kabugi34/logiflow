import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WarehouseCardComponent } from '../components/warehouse-card/warehouse-card.component';
import { WarehouseDetailsComponent } from '../components/warehouse-details/warehouse-details.component';
import { ManufacturerWarehouseService } from '../warehouse.service';
import { personName, trimmedRequired } from '../../../../core/forms/form-validators';

@Component({
  selector: 'app-warehouse-overview',
  standalone: true,
  imports: [
    FormValidationSummaryComponent,
    ReactiveFormsModule,
    RouterLink,
    WarehouseCardComponent,
    WarehouseDetailsComponent,
  ],
  templateUrl: './warehouse-overview.component.html',
})
export class WarehouseOverviewComponent {
  private readonly warehouseService = inject(ManufacturerWarehouseService);
  private readonly fb = inject(FormBuilder);
  protected readonly warehouses = this.warehouseService.warehouses;
  protected readonly selectedWarehouseId = signal<string | null>('NBO-A1');
  protected readonly selectedWarehouse = computed(() => {
    const id = this.selectedWarehouseId();
    return id ? (this.warehouseService.findById(id) ?? null) : null;
  });
  protected readonly createOpen = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [trimmedRequired, Validators.maxLength(80)]],
    address: ['', [trimmedRequired, Validators.maxLength(120)]],
    city: ['', [trimmedRequired, personName, Validators.maxLength(60)]],
    postalCode: ['', [Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9 -]*$/)]],
    siteManager: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
  });

  protected openCreate(): void {
    this.form.reset({ name: '', address: '', city: '', postalCode: '', siteManager: '' });
    this.error.set('');
    this.createOpen.set(true);
  }
  protected createWarehouse(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      const row = this.warehouseService.createWarehouse(this.form.getRawValue());
      this.selectedWarehouseId.set(row.id);
      this.createOpen.set(false);
      this.message.set('Warehouse added to the organization.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to create warehouse.');
    }
  }
  protected toggleSelectedStatus(): void {
    const id = this.selectedWarehouseId();
    if (id && this.warehouseService.toggleStatus(id)) this.message.set('Warehouse status updated.');
  }

  protected selectWarehouse(id: string): void {
    this.selectedWarehouseId.set(id);
  }

  protected closeDetails(): void {
    this.selectedWarehouseId.set(null);
  }
}
