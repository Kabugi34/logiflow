import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ManufacturerProductService } from '../product.service';
import { LoadingIndicatorComponent } from '../../../../shared/loading/loading-indicator.component';
import { trimmedRequired } from '../../../../core/forms/form-validators';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormValidationSummaryComponent, LoadingIndicatorComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly productService = inject(ManufacturerProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly selectedImage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly productSku = this.route.snapshot.paramMap.get('sku') ?? '';
  protected readonly categories = ['Motors', 'Transmission', 'Electronics', 'Valves', 'Other'];
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [trimmedRequired, Validators.maxLength(120)]],
    category: ['', trimmedRequired],
    brand: [''],
    unit: ['Pcs', trimmedRequired],
    description: [''],
    sku: [
      '',
      [trimmedRequired, Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9-]*$/)],
    ],
    unitPrice: [0, [Validators.required, Validators.min(0.01)]],
    initialQuantity: [0, [Validators.required, Validators.min(0)]],
    reorderThreshold: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    effect(() => {
      const product = this.productService.products().find(row => row.sku === this.productSku);
      if (product && !this.form.dirty) this.form.patchValue({
        name: product.name, category: product.category, sku: product.sku,
        brand: product.brand, unit: product.unit, description: product.description,
      });
    });
  }

  protected chooseImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.selectedImage.set(file.name);
  }

  protected submit(): void {
    if (this.isSubmitting()) return;
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const request = this.productSku
      ? this.productService.update(String(this.productService.findBySku(this.productSku)?.id ?? ''), this.form.getRawValue())
      : this.productService.create(this.form.getRawValue());
    if (this.productSku && !this.productService.findBySku(this.productSku)) {
      this.isSubmitting.set(false);
      this.errorMessage.set('This product is not available to edit. Refresh the product list and try again.');
      return;
    }
    request.pipe(
      finalize(() => this.isSubmitting.set(false)),
    ).subscribe({
      next: () => {
        this.productService.refresh();
        void this.router.navigate(['/manufacturer/products']);
      },
      error: (error) => this.errorMessage.set(error?.error?.message ?? 'Unable to save this product to the API.'),
    });
  }
}
