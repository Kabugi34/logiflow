import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DistributorCatalogService } from '../catalog.service';

@Component({
  selector: 'app-master-catalog',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './master-catalog.component.html'
})
export class MasterCatalogComponent {
  protected readonly catalogService = inject(DistributorCatalogService);
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('All categories');

  protected readonly categories = computed(() => [
    'All categories',
    ...new Set(this.catalogService.availableProducts().map(product => product.category))
  ]);

  protected readonly filteredProducts = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();

    return this.catalogService.availableProducts().filter(product => {
      const matchesQuery = !query || [product.name, product.sku, product.manufacturerName].some(value => value.toLowerCase().includes(query));
      const matchesCategory = this.selectedCategory() === 'All categories' || product.category === this.selectedCategory();
      return matchesQuery && matchesCategory;
    });
  });

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
  }
}
