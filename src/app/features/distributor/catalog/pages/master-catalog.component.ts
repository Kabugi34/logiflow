import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DistributorCatalogService } from '../catalog.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-master-catalog',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './master-catalog.component.html',
})
export class MasterCatalogComponent {
  protected readonly catalogService = inject(DistributorCatalogService);
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('All categories');
  protected readonly actionMessage = signal('');
  protected readonly pendingOfferId = signal('');
  protected readonly pendingProductId = signal('');

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
      const matchesCategory =
        this.selectedCategory() === 'All categories' ||
        product.category === this.selectedCategory();
      return matchesQuery && matchesCategory;
    });
  });

  protected toggleOffer(offer: import('../catalog.models').DistributorCatalogOffer): void {
    if (this.pendingOfferId()) return;
    this.actionMessage.set('');
    this.pendingOfferId.set(offer.id);
    this.catalogService.updateOffer(offer.id, { active: offer.status !== 'ACTIVE' }).pipe(
      finalize(() => this.pendingOfferId.set('')),
    ).subscribe({
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
    this.pendingProductId.set(productId); this.actionMessage.set('');
    this.catalogService.requestAuthorization(productId).pipe(finalize(() => this.pendingProductId.set(''))).subscribe({
      next: () => { this.catalogService.refresh(); this.actionMessage.set('Request sent. You can list the product after manufacturer approval.'); },
      error: error => this.actionMessage.set(error?.error?.message ?? 'Authorization request could not be sent.')
    });
  }
  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
  }
}
