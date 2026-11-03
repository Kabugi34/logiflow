import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DistributorCatalogService } from '../../catalog/catalog.service';
import { trimmedRequired } from '../../../../core/forms/form-validators';
import { finalize } from 'rxjs';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';

@Component({
  selector: 'app-distributor-warehouse-directory',
  standalone: true,
  imports: [
    FormValidationSummaryComponent,
    LoadingSkeletonComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './warehouse-directory.component.html',
})
export class WarehouseDirectoryComponent {
  protected readonly service = inject(DistributorCatalogService);
  private readonly fb = inject(FormBuilder);
  protected readonly warehouses = this.service.allWarehouses;
  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;
  protected readonly dialog = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly actionError = signal('');
  protected readonly archiveTargetId = signal('');
  protected readonly updatingWarehouseId = signal('');
  protected readonly archiveTarget = computed(() =>
    this.warehouses().find((warehouse) => warehouse.id === this.archiveTargetId()),
  );
  protected readonly form = this.fb.nonNullable.group({
    code: ['', [trimmedRequired, Validators.maxLength(24), Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', [trimmedRequired, Validators.maxLength(80)]],
    address: ['', [trimmedRequired, Validators.maxLength(160)]],
    city: ['', [trimmedRequired, Validators.maxLength(60)]],
    postalCode: ['', [trimmedRequired, Validators.maxLength(20)]],
    siteManager: ['', [trimmedRequired, Validators.maxLength(80)]],
  });
  protected create(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.message.set('');
    this.service
      .createWarehouse(this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.service.refresh();
          this.dialog.set(false);
          this.form.reset({
            code: '',
            name: '',
            address: '',
            city: '',
            postalCode: '',
            siteManager: '',
          });
          this.message.set('Warehouse created.');
        },
        error: (error) => {
          this.message.set(
            error?.error?.message ??
              'Warehouse could not be created. Check your organization role and try again.',
          );
        },
      });
  }

  protected confirmWarehouseStatusChange(): void {
    const warehouse = this.archiveTarget();
    if (!warehouse || this.updatingWarehouseId()) return;
    this.updatingWarehouseId.set(warehouse.id);
    this.actionError.set('');
    this.service
      .updateWarehouseStatus(warehouse.id, warehouse.active ? 'INACTIVE' : 'ACTIVE')
      .pipe(finalize(() => this.updatingWarehouseId.set('')))
      .subscribe({
        next: () => {
          this.archiveTargetId.set('');
          this.service.refresh();
          this.message.set(
            warehouse.active
              ? 'Warehouse archived. Existing records were preserved.'
              : 'Warehouse reactivated.',
          );
        },
        error: (error) => {
          this.actionError.set(
            error?.error?.message ??
              'Warehouse status could not be changed. Warehouses with active stock or operational dependencies must remain active.',
          );
        },
      });
  }
}
