import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap, takeWhile, timer } from 'rxjs';
import { DistributorCatalogService } from '../../catalog/catalog.service';
import { DistributorProcurementService } from '../procurement.service';
import { CentralizedCheckoutService, CheckoutResponse } from '../checkout.service';

@Component({
  selector: 'app-centralized-checkout',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './centralized-checkout.component.html',
})
export class CentralizedCheckoutComponent {
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly catalog = inject(DistributorCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly checkoutApi = inject(CentralizedCheckoutService);
  protected readonly quantities = signal<Record<string, number>>({});
  protected readonly warehouses = signal<Record<string, string>>({});
  protected readonly checkout = signal<CheckoutResponse | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly paymentMethod = signal<'DEMO_MPESA' | 'DEMO_CARD'>('DEMO_MPESA');
  private readonly createKey = signal(globalThis.crypto.randomUUID());
  private readonly paymentKeys = new Map<string, string>();
  protected readonly suppliers = computed(() => {
    const products = this.procurement.checkoutProducts();
    return [...new Set(products.map((product) => product.organizationId))].map((id) => ({
      id,
      name: products.find((product) => product.organizationId === id)?.manufacturerName ?? 'Supplier',
      products: products.filter((product) => product.organizationId === id),
    }));
  });
  protected readonly selectedCount = computed(() => Object.values(this.quantities()).filter((quantity) => quantity > 0).length);
  protected readonly selectedSupplierCount = computed(() => {
    const selected = new Set<string>();
    for (const supplier of this.suppliers()) {
      if (supplier.products.some((product) => this.quantity(product.id) > 0)) selected.add(supplier.id);
    }
    return selected.size;
  });
  protected readonly activeWarehouses = computed(() => this.catalog.allWarehouses().filter((warehouse) => warehouse.active));

  constructor() {
    const existingCheckoutId = this.route.snapshot.queryParamMap.get('checkout');
    if (existingCheckoutId) this.loadCheckout(existingCheckoutId);
    effect(() => {
      if (this.route.snapshot.queryParamMap.has('checkout')) return;
      const products = this.procurement.checkoutProducts();
      const sku = this.route.snapshot.queryParamMap.get('sku');
      const manufacturerId = this.route.snapshot.queryParamMap.get('manufacturer');
      const initial = products.find((product) => product.sku === sku && (!manufacturerId || product.organizationId === manufacturerId));
      if (initial && this.quantities()[initial.id] === undefined) {
        const quantity = initial.inStock === false || initial.availableQuantity === 0 ? 0 : 1;
        this.quantities.update((quantities) => ({ ...quantities, [initial.id]: quantity }));
      }
    });
  }

  protected quantity(id: string): number { return this.quantities()[id] ?? 0; }
  protected setQuantity(id: string, value: string): void {
    const product = this.procurement.checkoutProducts().find((row) => row.id === id);
    let quantity = Math.max(0, Math.floor(Number(value) || 0));
    if (product?.inStock === false) quantity = 0;
    if (product?.availableQuantity !== null && product?.availableQuantity !== undefined) {
      quantity = Math.min(quantity, product.availableQuantity);
    }
    this.quantities.update((rows) => ({ ...rows, [id]: quantity }));
    this.createKey.set(globalThis.crypto.randomUUID());
  }
  protected warehouse(supplierId: string): string { return this.warehouses()[supplierId] ?? ''; }
  protected setWarehouse(supplierId: string, warehouseId: string): void {
    this.warehouses.update((rows) => ({ ...rows, [supplierId]: warehouseId }));
    this.createKey.set(globalThis.crypto.randomUUID());
  }
  protected createCheckout(): void {
    if (this.busy()) return;
    const grouped = this.suppliers().map((supplier) => ({
      supplierOrganizationId: supplier.id,
      destinationWarehouseId: this.warehouse(supplier.id),
      items: supplier.products.filter((product) => this.quantity(product.id) > 0).map((product) => ({ stockItemId: product.id, quantity: this.quantity(product.id), distributorOfferId: null })),
    })).filter((group) => group.items.length);
    const invalidQuantity = this.suppliers().some((supplier) =>
      supplier.products.some((product) => {
        const quantity = this.quantity(product.id);
        return quantity > 0 && (!Number.isInteger(quantity) || (product.availableQuantity !== null && quantity > product.availableQuantity));
      }),
    );
    if (invalidQuantity) { this.error.set('Enter a whole quantity within the currently reported availability.'); return; }
    if (!grouped.length) { this.error.set('Select at least one product with a quantity greater than zero.'); return; }
    if (grouped.some((group) => !group.destinationWarehouseId)) { this.error.set('Choose a destination warehouse for every supplier.'); return; }
    this.error.set(''); this.busy.set(true);
    this.checkoutApi.create({ supplierOrders: grouped }, this.createKey())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({ next: (result) => { this.checkout.set(result); void this.router.navigate([], { relativeTo: this.route, queryParams: { checkout: result.id }, queryParamsHandling: 'merge' }); }, error: (error) => this.showError(error, 'Checkout could not be created.') });
  }
  protected pay(): void {
    const checkout = this.checkout();
    if (!checkout || this.busy()) return;
    // A recorded attempt must be read from the backend, never submitted again here.
    if (checkout.payment) { this.refresh(); return; }
    this.busy.set(true); this.error.set('');
    const key = this.paymentKey(checkout.id);
    this.paymentKeys.set(checkout.id, key);
    this.checkoutApi.initiatePayment(checkout.id, this.paymentMethod(), key)
      .pipe(switchMap((result) => {
        this.checkout.set(result);
        return this.poll(checkout.id);
      }), finalize(() => this.busy.set(false)))
      .subscribe({ next: (result) => this.checkout.set(result), error: (error) => this.showError(error, 'Payment status could not be read. Refresh checkout before taking another action.') });
  }
  protected refresh(): void {
    const checkout = this.checkout(); if (!checkout) return;
    this.busy.set(true);
    this.checkoutApi.get(checkout.id).subscribe({ next: (result) => { this.checkout.set(result); this.busy.set(false); if (result.payment?.status === 'PENDING') this.watchPayment(checkout.id); }, error: (error) => { this.busy.set(false); this.showError(error, 'Checkout could not be refreshed.'); } });
  }
  private loadCheckout(id: string): void {
    this.busy.set(true);
    this.checkoutApi.get(id).subscribe({
      next: (result) => { this.checkout.set(result); this.busy.set(false); if (result.payment?.status === 'PENDING') this.watchPayment(id); },
      error: (error) => { this.busy.set(false); this.showError(error, 'Checkout could not be loaded.'); },
    });
  }
  private poll(id: string) {
    return timer(0, 1000).pipe(
      switchMap(() => this.checkoutApi.get(id)),
      takeWhile((row) => row.payment?.status === 'PENDING', true),
    );
  }
  private watchPayment(id: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.poll(id).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (result) => this.checkout.set(result),
      error: (error) => this.showError(error, 'Payment status could not be read. Refresh checkout before taking another action.'),
    });
  }
  protected cancel(): void {
    const checkout = this.checkout(); if (!checkout || this.busy()) return;
    this.busy.set(true);
    this.checkoutApi.cancel(checkout.id).pipe(finalize(() => this.busy.set(false))).subscribe({ next: (result) => this.checkout.set(result), error: (error) => this.showError(error, 'Checkout could not be cancelled.') });
  }
  private paymentKey(checkoutId: string): string {
    const cached = this.paymentKeys.get(checkoutId) ?? sessionStorage.getItem(`logiflow.checkout.payment.${checkoutId}`);
    if (cached) return cached;
    const key = globalThis.crypto.randomUUID();
    this.paymentKeys.set(checkoutId, key);
    sessionStorage.setItem(`logiflow.checkout.payment.${checkoutId}`, key);
    return key;
  }
  private showError(error: any, fallback: string): void { this.error.set(error?.error?.message ?? fallback); }
}
