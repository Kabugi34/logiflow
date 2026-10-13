import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DistributorCatalogService } from '../catalog.service';

@Component({
  selector: 'app-catalog-offer-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './catalog-offer-form.component.html'
})
export class CatalogOfferFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogService = inject(DistributorCatalogService);

  protected readonly errorMessage = signal('');
  protected readonly availableProducts = this.catalogService.availableProducts;

  protected readonly form = this.formBuilder.nonNullable.group({
    sku: ['', Validators.required],
    productName: ['', Validators.required],
    manufacturerName: ['', Validators.required],
    manufacturerId: [''],
    category: ['', Validators.required],
    brand: ['', Validators.required],
    unit: ['Pcs', Validators.required],
    listPrice: [0, [Validators.required, Validators.min(0.01)]],
    minimumOrderQty: [1, [Validators.required, Validators.min(1)]],
    notes: ['']
  });

  constructor() {
    const selectedSku = this.route.snapshot.queryParamMap.get('sku') ?? '';
    if (selectedSku) {
      const product = this.catalogService.availableProducts().find(item => item.sku === selectedSku);
      if (product) {
        this.form.patchValue({
          sku: product.sku,
          productName: product.name,
          manufacturerName: product.manufacturerName,
          category: product.category,
          brand: product.brand,
          unit: product.unit
        });
      }
    }
  }

  protected updateSelectedProduct(event: Event): void {
    const sku = (event.target as HTMLSelectElement).value;
    const product = this.catalogService.availableProducts().find(item => item.sku === sku);

    if (!product) return;

    this.form.patchValue({
      sku: product.sku,
      productName: product.name,
      manufacturerName: product.manufacturerName,
      category: product.category,
      brand: product.brand,
      unit: product.unit
    });
  }

  protected submit(): void {
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      this.catalogService.addOffer({
        ...this.form.getRawValue(),
        manufacturerId: 'MFG-UNKNOWN',
        notes: this.form.getRawValue().notes ?? ''
      });
      void this.router.navigate(['/distributor/catalog']);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to save catalog offer.');
    }
  }
}
