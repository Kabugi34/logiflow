import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DistributorCatalogService } from '../../catalog/catalog.service';
import { DistributorInventoryService } from '../inventory.service';
import { DistributorProcurementService } from '../../procurement/procurement.service';
import { ManufacturerProductService } from '../../../manufacturer/products/product.service';
import { StockLevel } from '../inventory.models';
import { finalize } from 'rxjs';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';

@Component({
  selector: 'app-distributor-inventory-center',
  imports: [CurrencyPipe, DecimalPipe, LoadingSkeletonComponent, RouterLink],
  templateUrl: './inventory-center.component.html',
})
export class InventoryCenterComponent {
  protected readonly inventoryService = inject(DistributorInventoryService);
  private readonly catalogService = inject(DistributorCatalogService);
  private readonly productService = inject(ManufacturerProductService);
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly searchTerm = signal('');
  protected readonly selectedLevel = signal<'ALL' | StockLevel>('ALL');
  protected readonly stockFilters: { value: 'ALL' | StockLevel; label: string }[] = [
    { value: 'ALL', label: 'All stock' },
    { value: 'LOW', label: 'Low stock' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HEALTHY', label: 'Healthy' },
  ];
  protected readonly items = computed(() => {
    const offers = new Map(this.catalogService.offers().map((offer) => [offer.sku, offer]));
    return this.inventoryService.items().map((item) => {
      const product = this.productService.findBySku(item.sku);
      const offer = offers.get(item.sku);
      return {
        ...item,
        manufacturerName: product
          ? (this.procurement.manufacturerForBrand(product.brand)?.name ?? product.brand)
          : 'Manufacturer partner',
        listed: Boolean(offer),
        listPrice: offer?.listPrice ?? item.unitPrice,
        level: this.inventoryService.stockLevel(item),
      };
    });
  });
  protected readonly filteredItems = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.items().filter((item) => {
      const matchesText =
        !query ||
        [item.name, item.sku, item.manufacturerName, item.category].some((value) =>
          value.toLowerCase().includes(query),
        );
      return matchesText && (this.selectedLevel() === 'ALL' || item.level === this.selectedLevel());
    });
  });
  protected readonly totalUnits = computed(() =>
    this.items().reduce((sum, item) => sum + item.onHand, 0),
  );
  protected readonly inventoryValue = computed(() =>
    this.items().reduce((sum, item) => sum + item.onHand * item.unitPrice, 0),
  );
  protected readonly lowStockCount = computed(
    () => this.items().filter((item) => item.level !== 'HEALTHY').length,
  );
  protected readonly listedCount = computed(
    () => this.items().filter((item) => item.listed).length,
  );
  protected readonly restockFeedback = signal<Record<string, string>>({});
  protected readonly pendingRestockActions = signal<Record<string, 'request' | 'cancel'>>({});

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateLevel(level: 'ALL' | StockLevel): void {
    this.selectedLevel.set(level);
  }

  protected requestRestock(sku: string): void {
    if (this.pendingRestockActions()[sku]) return;
    const item = this.inventoryService.findBySku(sku);
    if (!item) return;
    const quantity = Math.max(1, item.lowStockThreshold - item.onHand);
    this.pendingRestockActions.update((state) => ({ ...state, [sku]: 'request' }));
    try {
      this.inventoryService
        .requestRestock(item, quantity, 'Requested from distributor inventory.')
        .pipe(finalize(() => this.pendingRestockActions.update((state) => {
          const { [sku]: _pending, ...rest } = state;
          return rest;
        })))
        .subscribe({
          next: () => {
            this.restockFeedback.update((state) => ({
              ...state,
              [sku]: 'Restock request submitted.',
            }));
            this.inventoryService.refreshRestockRequests();
          },
          error: (error) =>
            this.restockFeedback.update((state) => ({
              ...state,
              [sku]: error?.error?.message ?? 'Restock request failed.',
            })),
        });
    } catch (error) {
      this.pendingRestockActions.update((state) => {
        const { [sku]: _pending, ...rest } = state;
        return rest;
      });
      this.restockFeedback.update((state) => ({
        ...state,
        [sku]: error instanceof Error ? error.message : 'Restock request failed.',
      }));
    }
  }

  protected pendingRestockId(id: string): string | undefined {
    return this.inventoryService.pendingRestockId(id);
  }

  protected cancelRestock(id: string, sku: string): void {
    if (this.pendingRestockActions()[sku]) return;
    this.pendingRestockActions.update((state) => ({ ...state, [sku]: 'cancel' }));
    this.inventoryService.cancelRestockRequest(id).pipe(
      finalize(() => this.pendingRestockActions.update((state) => {
        const { [sku]: _pending, ...rest } = state;
        return rest;
      })),
    ).subscribe({
      next: () => {
        this.restockFeedback.update((state) => ({ ...state, [sku]: 'Restock request cancelled.' }));
        this.inventoryService.refreshRestockRequests();
      },
      error: (error) =>
        this.restockFeedback.update((state) => ({
          ...state,
          [sku]: error?.error?.message ?? 'Restock request could not be cancelled.',
        })),
    });
  }
  protected hasPendingRestock(id: string): boolean {
    return this.inventoryService.hasPendingRestock(id);
  }

  protected levelClass(level: StockLevel): string {
    switch (level) {
      case 'HEALTHY':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'LOW':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'CRITICAL':
        return 'border-red-200 bg-red-50 text-red-700';
    }
  }
}
