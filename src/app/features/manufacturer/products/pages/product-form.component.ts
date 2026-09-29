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
    brand: ['', [Validators.required, Validators.maxLength(80)]],
    category: ['', Validators.required],
    sku: ['', [Validators.required, Validators.maxLength(40)]],
    unit: ['Pcs', [Validators.required, Validators.maxLength(24)]],
    description: ['', [Validators.required, Validators.maxLength(1000)]]
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
    try {
      this.productService.save({
        ...this.form.getRawValue(),
        image: this.selectedImage() || 'assets/images/products/product-placeholder.jpg'
      });
      void this.router.navigate(['/manufacturer/products']);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to save this product.');
    }
  }
}
