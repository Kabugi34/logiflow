import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ManufacturerProductService } from '../product.service';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { ProductPublicationStatus } from '../product.models';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [DecimalPipe, LoadingSkeletonComponent, RouterLink],
  templateUrl: './product-list.component.html'
})
export class ProductListComponent {
  protected readonly productService = inject(ManufacturerProductService);
  private readonly authService = inject(AuthService);
  protected readonly canManagePublication = this.authService.hasRole('MANUFACTURER_ADMIN');
  protected readonly pendingProductId = signal('');
  protected readonly actionError = signal('');
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('All categories');
  protected readonly selectedStatus = signal('All statuses');
  protected readonly categories = computed(() => [...new Set(this.productService.products().map(product => product.category))]);
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

  protected togglePublication(productId: string, status: ProductPublicationStatus): void {
    if (!this.canManagePublication || this.pendingProductId()) return;
    const nextStatus: ProductPublicationStatus = status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    this.actionError.set('');
    this.pendingProductId.set(productId);
    this.productService.setPublicationStatus(productId, nextStatus).pipe(
      finalize(() => this.pendingProductId.set('')),
    ).subscribe({
      next: () => this.productService.refresh(),
      error: error => this.actionError.set(error?.error?.message ?? 'Product publication could not be updated.'),
    });
  }

  protected productId(id: string | number): string { return String(id); }
}
