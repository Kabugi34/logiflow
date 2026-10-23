import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DistributorCatalogService } from '../../catalog/catalog.service';
import { trimmedRequired } from '../../../../core/forms/form-validators';

@Component({
  selector: 'app-distributor-warehouse-directory',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './warehouse-directory.component.html',
})
export class WarehouseDirectoryComponent {
  protected readonly service = inject(DistributorCatalogService);
  private readonly fb = inject(FormBuilder);
  protected readonly warehouses = this.service.warehouses;
  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;
  protected readonly dialog = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly form = this.fb.nonNullable.group({
    code: ['', [trimmedRequired, Validators.maxLength(24), Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', [trimmedRequired, Validators.maxLength(80)]],
    address: ['', [trimmedRequired, Validators.maxLength(160)]],
  });
  protected create(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.message.set('');
    this.service.createWarehouse(this.form.getRawValue()).subscribe({
      next: () => {
        this.service.refresh();
        this.saving.set(false);
        this.dialog.set(false);
        this.form.reset({ code: '', name: '', address: '' });
        this.message.set('Warehouse created.');
      },
      error: (error) => {
        this.saving.set(false);
        this.message.set(
          error?.error?.message ??
            'Warehouse could not be created. Check your organization role and try again.',
        );
      },
    });
  }
}
