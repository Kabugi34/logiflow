import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ManufacturerProductService } from '../product.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-form.component.html'
})
export class ProductFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly productService = inject(ManufacturerProductService);
  private readonly router = inject(Router);
  protected readonly selectedImage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly categories = ['Motors', 'Transmission', 'Electronics', 'Valves', 'Other'];
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    category: ['', Validators.required],
    sku: ['', [Validators.required, Validators.maxLength(40)]],
    unitPrice: [0, [Validators.required, Validators.min(0.01)]],
    initialQuantity: [0, [Validators.required, Validators.min(0)]],
    reorderThreshold: [0, [Validators.required, Validators.min(0)]]
  });

  protected chooseImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.selectedImage.set(file.name);
  }

  protected submit(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.productService.save(this.form.getRawValue()).subscribe({
      next: () => { this.productService.refresh(); void this.router.navigate(['/manufacturer/products']); },
      error: error => this.errorMessage.set(error?.error?.message ?? 'Unable to save this product to the API.')
    });
  }
}
