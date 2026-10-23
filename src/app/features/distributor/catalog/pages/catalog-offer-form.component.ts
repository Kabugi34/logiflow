import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DistributorCatalogService } from '../catalog.service';
import { trimmedRequired } from '../../../../core/forms/form-validators';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-catalog-offer-form',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './catalog-offer-form.component.html',
})
export class CatalogOfferFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogService = inject(DistributorCatalogService);
  protected readonly errorMessage = signal('');
  protected readonly saving = signal(false);
  protected readonly warehouseSaving = signal(false);
  protected readonly warehouseMessage = signal('');
  protected readonly availableProducts = this.catalogService.availableProducts;
  protected readonly warehouses = this.catalogService.warehouses;

  protected readonly warehouseForm = this.formBuilder.nonNullable.group({
    code: ['', [trimmedRequired, Validators.maxLength(24), Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', [trimmedRequired, Validators.maxLength(80)]],
    address: ['', Validators.maxLength(160)],
  });

  protected readonly form = this.formBuilder.nonNullable.group({
    sku: ['', trimmedRequired],
    productName: ['', trimmedRequired],
    manufacturerName: ['', trimmedRequired],
    manufacturerId: ['', trimmedRequired],
    sourceStockItemId: ['', trimmedRequired],
    category: ['', trimmedRequired],
    brand: [''],
    unit: ['Pcs'],
    warehouseId: ['', trimmedRequired],
    listPrice: [0, [Validators.required, Validators.min(0.01)]],
    reorderThreshold: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    const selectedSku = this.route.snapshot.queryParamMap.get('sku') ?? '';
    if (selectedSku)
      effect(() => {
        this.availableProducts();
        this.selectProduct(selectedSku);
      });
  }

  protected createWarehouse(): void {
    if (this.warehouseSaving()) return;
    if (this.warehouseForm.invalid) {
      this.warehouseForm.markAllAsTouched();
      return;
    }
    this.warehouseSaving.set(true);
    this.warehouseMessage.set('');
    this.catalogService.createWarehouse(this.warehouseForm.getRawValue()).pipe(
      finalize(() => this.warehouseSaving.set(false)),
    ).subscribe({
      next: (warehouse) => {
        this.catalogService.refresh();
        this.form.controls.warehouseId.setValue(warehouse.id);
        this.warehouseForm.reset({ code: '', name: '', address: '' });
        this.warehouseMessage.set('Warehouse created.');
      },
      error: (error) => {
        this.warehouseMessage.set(
          error?.error?.message ?? 'Warehouse creation is available to distributor administrators.',
        );
      },
    });
  }
  protected updateSelectedProduct(event: Event): void {
    this.selectProduct((event.target as HTMLSelectElement).value);
  }

  protected submit(): void {
    if (this.saving()) return;
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (
      !this.warehouses().some((warehouse) => warehouse.id === this.form.controls.warehouseId.value)
    ) {
      this.errorMessage.set(
        'Select an active warehouse belonging to your distributor organization.',
      );
      return;
    }
    const { sku, sourceStockItemId, warehouseId, listPrice, reorderThreshold } =
      this.form.getRawValue();
    this.saving.set(true);
    this.catalogService
      .addOffer({ sourceStockItemId, warehouseId, sku, listPrice, reorderThreshold })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.catalogService.refresh();
          void this.router.navigate(['/distributor/catalog']);
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message ?? 'Unable to save catalog offer.');
        },
      });
  }

  private selectProduct(sku: string): void {
    const product = this.availableProducts().find((item) => item.sku === sku);
    if (!product) return;
    this.form.patchValue({
      sku: product.sku,
      sourceStockItemId: product.id,
      manufacturerId: product.manufacturerId,
      productName: product.name,
      manufacturerName: product.manufacturerName,
      category: product.category,
      brand: product.brand,
      unit: product.unit,
    });
  }
}
