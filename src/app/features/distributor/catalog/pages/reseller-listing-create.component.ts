import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthenticatedImageComponent } from '../../../../shared/authenticated-image.component';
import { DistributorResellerListingService } from '../reseller-listing.service';
import { EligibleResellerProduct } from '../reseller-listing.models';

@Component({
  selector: 'app-reseller-listing-create',
  standalone: true,
  imports: [AuthenticatedImageComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './reseller-listing-create.component.html',
})
export class ResellerListingCreateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly service = inject(DistributorResellerListingService);
  protected readonly products = signal<EligibleResellerProduct[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly form = this.fb.nonNullable.group({
    manufacturerProductId: ['', Validators.required],
    retailPrice: [0, [Validators.required, Validators.min(0.01)]],
  });
  protected readonly selectedProduct = computed(() =>
    this.products().find((product) => product.manufacturerProductId === this.form.controls.manufacturerProductId.value),
  );
  protected readonly availableProducts = computed(() => this.products().filter((product) => !product.alreadyListed));

  constructor() {
    this.service.eligibleProducts().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (products) => {
        this.products.set(products);
        const productId = this.route.snapshot.queryParamMap.get('productId');
        if (productId && products.some((product) => product.manufacturerProductId === productId && !product.alreadyListed)) {
          this.form.controls.manufacturerProductId.setValue(productId);
        }
      },
      error: (error) => this.error.set(error?.error?.message ?? 'Eligible purchased products could not be loaded.'),
    });
  }

  protected imageUrl(product: EligibleResellerProduct): string {
    return this.service.productImageUrl(product);
  }

  protected create(): void {
    this.error.set('');
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { manufacturerProductId, retailPrice } = this.form.getRawValue();
    const product = this.availableProducts().find((row) => row.manufacturerProductId === manufacturerProductId);
    if (!product) {
      this.error.set('Select a product that is currently eligible and not already listed.');
      return;
    }
    this.saving.set(true);
    this.service.create({ manufacturerProductId, retailPrice }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (listing) => void this.router.navigate(['/distributor/catalog/my', listing.id]),
      error: (error) => this.error.set(error?.error?.message ?? 'Reseller listing could not be created.'),
    });
  }
}

