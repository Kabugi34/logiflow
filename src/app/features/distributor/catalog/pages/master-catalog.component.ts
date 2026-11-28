import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DistributorCatalogService } from '../catalog.service';
import { DistributorProcurementService } from '../../procurement/procurement.service';
import { DistributorPurchaseCartService } from '../../procurement/purchase-cart.service';
import { finalize } from 'rxjs';
import { trimmedRequired } from '../../../../core/forms/form-validators';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthenticatedImageComponent } from '../../../../shared/authenticated-image.component';

function authorizationRequestError(error: unknown): string {
  const response = error as {
    status?: number;
    error?: { code?: string; message?: string; detail?: string; title?: string; errors?: unknown };
    message?: string;
  };
  const body = response?.error;
  const code = body?.code?.toUpperCase();
  const serverMessage = body?.message?.trim() || body?.detail?.trim();

  if (response?.status === 409) {
    if (code === 'AUTHORIZATION_REQUEST_EXISTS' || code === 'DUPLICATE_AUTHORIZATION_REQUEST') {
      return 'A listing permission request already exists for this product. Check its current status in your catalog before submitting another.';
    }
    if (serverMessage) return serverMessage;
    return 'The manufacturer already has a listing permission request or an existing decision for this product. Refresh the catalog and check the request status.';
  }

  if (serverMessage) return serverMessage;
  if (body?.title?.trim()) return body.title.trim();
  return 'Authorization request could not be sent. Please try again.';
}

@Component({
  selector: 'app-master-catalog',
  standalone: true,
  imports: [AuthenticatedImageComponent, CurrencyPipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './master-catalog.component.html',
})
export class MasterCatalogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly procurement = inject(DistributorProcurementService);
  protected readonly cart = inject(DistributorPurchaseCartService);
  protected readonly catalogService = inject(DistributorCatalogService);
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('All categories');
  protected readonly selectedManufacturer = signal('All manufacturers');
  protected readonly actionMessage = signal('');
  protected readonly offerError = signal('');
  protected readonly pendingOfferId = signal('');
  protected readonly pendingProductId = signal('');
  protected readonly authorizationProductId = signal('');
  protected readonly authorizationError = signal('');
  protected readonly authorizationForm = this.fb.nonNullable.group({
    requestNote: ['', [trimmedRequired, Validators.maxLength(500)]],
    targetMarket: ['', Validators.maxLength(500)],
    salesChannels: ['', Validators.maxLength(500)],
    geographicalCoverage: ['', Validators.maxLength(500)],
    distributionStrategy: ['', Validators.maxLength(1000)],
  });
  protected readonly authorizationProduct = computed(() =>
    this.catalogService
      .availableProducts()
      .find((product) => product.id === this.authorizationProductId()),
  );

  protected readonly categories = computed(() => [
    'All categories',
    ...new Set(this.catalogService.availableProducts().map((product) => product.category)),
  ]);

  protected readonly filteredProducts = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();

    return this.catalogService.availableProducts().filter((product) => {
      const matchesQuery =
        !query ||
        [product.name, product.sku, product.manufacturerName].some((value) =>
          value.toLowerCase().includes(query),
        );
      const matchesManufacturer =
        this.selectedManufacturer() === 'All manufacturers' ||
        product.manufacturerId === this.selectedManufacturer();
      const matchesCategory =
        this.selectedCategory() === 'All categories' ||
        product.category === this.selectedCategory();
      return matchesQuery && matchesManufacturer && matchesCategory;
    });
  });

  protected saveOfferPrice(offer: import('../catalog.models').DistributorCatalogOffer, value: string): void {
    if (this.pendingOfferId()) return;
    const price = Number(value);
    if (!/^\d+(\.\d{1,2})?$/.test(value.trim()) || !Number.isFinite(price) || price < 0.01) {
      this.offerError.set('Enter a price of at least 0.01, with at most two decimal places.');
      return;
    }
    this.pendingOfferId.set(offer.id);
    this.offerError.set('');
    this.catalogService.updateOffer(offer.id, { sellingPrice: price }).pipe(
      finalize(() => this.pendingOfferId.set('')),
    ).subscribe({
      next: () => {
        this.catalogService.refresh();
        this.actionMessage.set('Price saved.');
      },
      error: (error) => this.offerError.set(error?.error?.message ?? 'The price could not be saved.'),
    });
  }

  protected saveOfferStock(offer: import('../catalog.models').DistributorCatalogOffer, value: string): void {
    if (this.pendingOfferId()) return;
    if (offer.quantityOnHand === null) {
      this.offerError.set('Stock could not be read. Refresh the catalog and try again.');
      return;
    }
    if (!/^\d+$/.test(value.trim())) {
      this.offerError.set('Enter stock as a whole number of units.');
      return;
    }
    const target = Number(value);
    const delta = target - offer.quantityOnHand;
    if (delta === 0) {
      this.actionMessage.set('Stock is already that quantity.');
      return;
    }
    this.pendingOfferId.set(offer.id);
    this.offerError.set('');
    this.catalogService.setOfferStock(offer.id, delta).pipe(
      finalize(() => this.pendingOfferId.set('')),
    ).subscribe({
      next: () => {
        this.catalogService.refresh();
        this.actionMessage.set('Stock saved.');
      },
      error: (error) => this.offerError.set(error?.error?.message ?? 'Stock could not be updated.'),
    });
  }

  protected replaceOfferImage(offer: import('../catalog.models').DistributorCatalogOffer, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.pendingOfferId()) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.offerError.set('Choose a PNG, JPEG, or WebP picture.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.offerError.set('The picture must be 5 MB or smaller.');
      return;
    }
    this.pendingOfferId.set(offer.id);
    this.offerError.set('');
    this.catalogService.replaceOfferImage(offer.id, file).pipe(
      finalize(() => this.pendingOfferId.set('')),
    ).subscribe({
      next: () => {
        this.catalogService.refresh();
        this.actionMessage.set('Picture saved.');
      },
      error: (error) => this.offerError.set(error?.error?.message ?? 'The picture could not be saved.'),
    });
  }

  protected toggleOffer(offer: import('../catalog.models').DistributorCatalogOffer): void {
    if (this.pendingOfferId()) return;
    this.actionMessage.set('');
    const activating = offer.status !== 'ACTIVE';
    if (activating) {
      const eligibilityError = this.catalogService.offerActivationError(offer);
      if (eligibilityError) {
        this.actionMessage.set(eligibilityError);
        return;
      }
    }
    this.pendingOfferId.set(offer.id);
    this.catalogService
      .updateOffer(offer.id, { active: activating })
      .pipe(finalize(() => this.pendingOfferId.set('')))
      .subscribe({
        next: () => {
          this.catalogService.refresh();
          this.actionMessage.set(offer.status === 'ACTIVE' ? 'Offer paused.' : 'Offer resumed.');
        },
        error: (error) =>
          this.actionMessage.set(error?.error?.message ?? 'Offer status could not be updated.'),
      });
  }
  protected requestAuthorization(productId: string): void {
    if (this.pendingProductId()) return;
    this.authorizationProductId.set(productId);
    this.authorizationError.set('');
    this.authorizationForm.reset({ requestNote: '', targetMarket: '', salesChannels: '', geographicalCoverage: '', distributionStrategy: '' });
    this.actionMessage.set('');
  }
  protected addToPurchaseCart(product: import('../catalog.models').DistributorCatalogProduct): void {
    const liveProduct = this.procurement.checkoutProducts().find((row) => row.productId === product.id);
    if (!liveProduct) {
      this.actionMessage.set('This product is not currently available for purchase. Refresh the catalog and try again.');
      return;
    }
    if (liveProduct.inStock === false || liveProduct.availableQuantity === 0) {
      this.actionMessage.set('This product is currently out of stock.');
      return;
    }
    this.cart.add({
      productId: liveProduct.productId,
      stockItemId: liveProduct.id,
      supplierOrganizationId: liveProduct.organizationId,
      supplierName: liveProduct.manufacturerName,
      name: liveProduct.name,
      sku: liveProduct.sku,
      quantity: 0,
    });
    void this.router.navigate(['/distributor/procurement/checkout']);
  }
  protected submitAuthorizationRequest(): void {
    const productId = this.authorizationProductId();
    if (!productId || this.pendingProductId()) return;
    if (this.authorizationForm.invalid) {
      this.authorizationForm.markAllAsTouched();
      return;
    }
    this.pendingProductId.set(productId);
    const organizationName = this.auth.user()?.organization.name?.trim();
    const request = this.authorizationForm.getRawValue();
    const requestNote = organizationName
      ? `Distributor organization: ${organizationName}\n\n${request.requestNote}`
      : request.requestNote;
    this.catalogService
      .requestAuthorization(productId, { ...request, requestNote })
      .pipe(finalize(() => this.pendingProductId.set('')))
      .subscribe({
        next: () => {
          this.authorizationProductId.set('');
          this.catalogService.refresh();
          this.actionMessage.set(
            'Request sent. You can list the product after manufacturer approval.',
          );
        },
        error: (error) => this.authorizationError.set(authorizationRequestError(error)),
      });
  }
  protected closeAuthorizationRequest(): void {
    if (!this.pendingProductId()) this.authorizationProductId.set('');
  }
  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
  }

  protected updateManufacturer(event: Event): void {
    this.selectedManufacturer.set((event.target as HTMLSelectElement).value);
  }
}
