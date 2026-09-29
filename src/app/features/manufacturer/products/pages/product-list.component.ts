import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ManufacturerProductService } from '../product.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  templateUrl: './product-list.component.html'
})
export class ProductListComponent {
  private readonly productService = inject(ManufacturerProductService);
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('All categories');
  protected readonly selectedStatus = signal('All statuses');
  protected readonly categories = [...new Set(this.productService.products().map(product => product.category))];
  protected readonly filteredProducts = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.productService.products().filter(product => {
      const matchesQuery = !query || [product.name, product.sku, product.brand].some(value => value.toLowerCase().includes(query));
      const matchesCategory = this.selectedCategory() === 'All categories' || product.category === this.selectedCategory();
      const matchesStatus = this.selectedStatus() === 'All statuses' || product.status === this.selectedStatus();
      return matchesQuery && matchesCategory && matchesStatus;
    });
  });

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
  }

  protected updateStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
  }
}
