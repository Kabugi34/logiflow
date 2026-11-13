import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ManufacturerProductService } from '../product.service';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { ManufacturerProduct, ProductPublicationStatus } from '../product.models';
import { finalize } from 'rxjs';
import { AuthenticatedImageComponent } from '../../../../shared/authenticated-image.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [AuthenticatedImageComponent, DecimalPipe, LoadingSkeletonComponent, RouterLink],
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
  protected readonly productToDiscontinue = signal<ManufacturerProduct | null>(null);
  protected readonly categories = computed(() => [...new Set(this.productService.products().map(product => product.category))]);
  protected readonly filteredProducts = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.productService.products().filter(product => {
      const matchesQuery = !query || [product.name, product.sku, product.brand, product.description].some(value => value.toLowerCase().includes(query));
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
    if (!this.canManagePublication || this.pendingProductId() || status === 'DISCONTINUED') return;
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

  protected requestDiscontinue(product: ManufacturerProduct): void {
    if (!this.canManagePublication || this.pendingProductId() || product.publicationStatus === 'DISCONTINUED') return;
    if (product.stock > 0) {
      this.actionError.set('A product cannot be removed from the catalog while stock remains on hand.');
      return;
    }
    this.actionError.set('');
    this.productToDiscontinue.set(product);
  }

  protected cancelDiscontinue(): void {
    if (!this.pendingProductId()) this.productToDiscontinue.set(null);
  }

  protected confirmDiscontinue(): void {
    const product = this.productToDiscontinue();
    if (!product || !this.canManagePublication || this.pendingProductId()) return;
    if (product.stock > 0) {
      this.actionError.set('A product cannot be removed from the catalog while stock remains on hand.');
      this.productToDiscontinue.set(null);
      return;
    }
    const id = this.productId(product.id);
    this.actionError.set('');
    this.pendingProductId.set(id);
    this.productService.setPublicationStatus(id, 'DISCONTINUED').pipe(
      finalize(() => this.pendingProductId.set('')),
    ).subscribe({
      next: () => {
        this.productToDiscontinue.set(null);
        this.productService.refresh();
      },
      error: error => this.actionError.set(error?.error?.message ?? 'Product could not be removed from the active catalog.'),
    });
  }

  protected productId(id: string | number): string { return String(id); }
}
