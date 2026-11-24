import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthenticatedImageComponent } from '../../../../shared/authenticated-image.component';
import { EligibleResellerProduct, ResellerListing } from '../reseller-listing.models';
import { DistributorResellerListingService } from '../reseller-listing.service';

@Component({
  selector: 'app-reseller-listing-detail',
  standalone: true,
  imports: [AuthenticatedImageComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './reseller-listing-detail.component.html',
})
export class ResellerListingDetailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly service = inject(DistributorResellerListingService);
  protected readonly listing = signal<ResellerListing | null>(null);
  protected readonly eligibleProduct = signal<EligibleResellerProduct | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly acceptedQuantity = computed(() => this.eligibleProduct()?.acceptedQuantity ?? this.listing()?.quantityOnHand ?? 0);
  protected readonly priceForm = this.fb.nonNullable.group({
    retailPrice: [0, [Validators.required, Validators.min(0.01)]],
  });
  private readonly listingId = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    this.refresh();
    this.service.eligibleProducts().subscribe({
      next: (products) => this.eligibleProduct.set(products.find((product) => product.manufacturerProductId === this.listing()?.manufacturerProductId) ?? null),
    });
  }

  protected refresh(): void {
    if (!this.listingId) {
      this.error.set('A listing ID is required.');
      this.loading.set(false);
      return;
    }
    this.service.get(this.listingId).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.priceForm.controls.retailPrice.setValue(listing.retailPrice);
        this.service.eligibleProducts().subscribe({
          next: (products) => this.eligibleProduct.set(products.find((product) => product.manufacturerProductId === listing.manufacturerProductId) ?? null),
        });
      },
      error: (error) => this.error.set(error?.error?.message ?? 'Reseller listing could not be loaded.'),
    });
  }

  protected updatePrice(): void {
    const listing = this.listing();
    if (!listing || this.priceForm.invalid || this.busy()) {
      this.priceForm.markAllAsTouched();
      return;
    }
    this.runAction(this.service.updateRetailPrice(listing.id, this.priceForm.getRawValue()), 'Retail price updated.');
  }

  protected toggleStatus(): void {
    const listing = this.listing();
    if (!listing || this.busy()) return;
    const action = listing.status === 'ACTIVE' ? this.service.pause(listing.id) : this.service.resume(listing.id);
    this.runAction(action, listing.status === 'ACTIVE' ? 'Listing paused.' : 'Listing resumed.');
  }

  protected archive(): void {
    const listing = this.listing();
    if (!listing || this.busy()) return;
    if (!globalThis.confirm(`Archive ${listing.productName}? Inventory will be retained.`)) return;
    this.busy.set(true);
    this.error.set('');
    this.service.archive(listing.id).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => void this.router.navigate(['/distributor/catalog/my']),
      error: (error) => this.error.set(error?.error?.message ?? 'Listing could not be archived.'),
    });
  }

  protected imageUrl(listing: ResellerListing): string {
    // The response imageUrl points at a CUSTOMER-only controller. Distributor
    // users read the same canonical image through ProductCatalogController.
    return this.service.productImageUrl({ manufacturerProductId: listing.manufacturerProductId, imageUrl: null });
  }

  private runAction(action: ReturnType<DistributorResellerListingService['pause']>, success: string): void;
  private runAction(action: ReturnType<DistributorResellerListingService['updateRetailPrice']>, success: string): void;
  private runAction(action: ReturnType<DistributorResellerListingService['resume']>, success: string): void;
  private runAction(action: import('rxjs').Observable<ResellerListing>, success: string): void {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    action.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.priceForm.controls.retailPrice.setValue(listing.retailPrice);
        this.notice.set(success);
      },
      error: (error) => this.error.set(error?.error?.message ?? 'Listing could not be updated.'),
    });
  }
}

