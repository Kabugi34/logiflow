import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, finalize, switchMap, takeWhile, tap, timer } from 'rxjs';
import { DistributorCatalogService } from '../../catalog/catalog.service';
import { DistributorProcurementService } from '../procurement.service';
import { DistributorPurchaseCartService, PurchaseCartLine } from '../purchase-cart.service';
import { CentralizedCheckoutService, CheckoutPaymentMethod, CheckoutPaymentStatus, CheckoutResponse } from '../checkout.service';

@Component({
  selector: 'app-centralized-checkout',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './centralized-checkout.component.html',
})
export class CentralizedCheckoutComponent {
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly catalog = inject(DistributorCatalogService);
  protected readonly cart = inject(DistributorPurchaseCartService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly checkoutApi = inject(CentralizedCheckoutService);
  protected readonly checkout = signal<CheckoutResponse | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly paymentMethod = signal<CheckoutPaymentMethod>('MPESA_SANDBOX');
  protected readonly paymentPhone = signal('');
  private readonly createKey = signal(globalThis.crypto.randomUUID());
  private readonly paymentKeys = new Map<string, string>();

  protected readonly cartRows = computed(() => this.cart.lines().map((line) => ({
    line,
    product: this.procurement.checkoutProducts().find((row) => row.productId === line.productId),
  })));
  protected readonly invalidCartRows = computed(() => this.cartRows().filter(({ line, product }) =>
    line.quantity < 1 || !product || this.catalog.authorizationStatus(line.productId) !== 'APPROVED' || product.inStock === false || product.availableQuantity === 0 ||
    (product.availableQuantity !== null && line.quantity > product.availableQuantity),
  ));
  protected readonly suppliers = computed(() => {
    const rows = this.cartRows().filter(({ line, product }) => !!product && this.catalog.authorizationStatus(line.productId) === 'APPROVED');
    return [...new Set(rows.map(({ line }) => line.supplierOrganizationId))].map((id) => ({
      id,
      name: rows.find(({ line }) => line.supplierOrganizationId === id)?.line.supplierName ?? 'Supplier',
      products: rows.filter(({ line }) => line.supplierOrganizationId === id),
    }));
  });
  protected readonly selectedCount = computed(() => this.cart.lines().length);
  protected readonly selectedSupplierCount = computed(() => this.suppliers().length);
  protected readonly cartTotal = computed(() => this.cartRows().reduce((sum, row) => sum + (row.product?.unitPrice ?? 0) * row.line.quantity, 0));
  protected readonly activeWarehouses = computed(() => this.catalog.allWarehouses().filter((warehouse) => warehouse.active));
  protected readonly paymentWaiting = computed(() => this.isPendingPayment(this.checkout()?.payment?.status));

  constructor() {
    const existingCheckoutId = this.route.snapshot.queryParamMap.get('checkout');
    if (existingCheckoutId) this.loadCheckout(existingCheckoutId);
  }

  protected quantity(line: PurchaseCartLine): number | '' { return line.quantity > 0 ? line.quantity : ''; }
  protected supplierSubtotal(products: { line: PurchaseCartLine; product: { unitPrice: number } | undefined }[]): number {
    return products.reduce((sum, row) => sum + (row.product?.unitPrice ?? 0) * row.line.quantity, 0);
  }
  protected setQuantity(line: PurchaseCartLine, value: string): void {
    if (value.trim() === '') { this.cart.setQuantity(line.productId, 0); this.createKey.set(globalThis.crypto.randomUUID()); return; }
    const quantity = Math.floor(Number(value));
    if (!Number.isFinite(quantity) || quantity < 1) return;
    this.cart.setQuantity(line.productId, quantity);
    this.createKey.set(globalThis.crypto.randomUUID());
  }
  protected removeProduct(line: PurchaseCartLine): void {
    this.cart.remove(line.productId);
    this.createKey.set(globalThis.crypto.randomUUID());
  }
  protected warehouse(supplierId: string): string { return this.cart.warehouse(supplierId); }
  protected setWarehouse(supplierId: string, warehouseId: string): void {
    this.cart.setWarehouse(supplierId, warehouseId);
    this.createKey.set(globalThis.crypto.randomUUID());
  }

  protected createCheckout(): void {
    if (this.busy()) return;
    if (this.invalidCartRows().length) { this.error.set('Remove unavailable items or correct quantities before checkout.'); return; }
    const groups = this.suppliers().map((supplier) => ({
      supplierOrganizationId: supplier.id,
      destinationWarehouseId: this.warehouse(supplier.id),
      items: supplier.products.map(({ line, product }) => ({ stockItemId: product!.id, quantity: line.quantity, distributorOfferId: null })),
    }));
    if (!groups.length) { this.error.set('Your cart is empty. Add products from the catalog to continue.'); return; }
    if (groups.some((group) => !group.destinationWarehouseId)) { this.error.set('Choose a destination warehouse for every supplier.'); return; }
    this.error.set(''); this.busy.set(true);
    const purchasedProductIds = this.cart.lines().map((line) => line.productId);
    this.checkoutApi.create({ supplierOrders: groups }, this.createKey())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (result) => {
          this.checkout.set(result);
          this.cart.checkoutCreated(result.id, purchasedProductIds);
          void this.router.navigate([], { relativeTo: this.route, queryParams: { checkout: result.id }, queryParamsHandling: 'merge' });
        },
        error: (error) => this.showError(error, 'Checkout could not be created. Your cart is unchanged.'),
      });
  }

  protected pay(): void {
    const checkout = this.checkout();
    if (!checkout || this.busy()) return;
    if (checkout.payment?.status === 'PENDING') { this.refresh(); return; }
    if (this.isSuccessfulPayment(checkout.payment?.status)) return;
    const phoneNumber = this.paymentPhone().trim().replace(/[\s()-]/g, '').replace(/^\+/, '');
    if (this.paymentMethod() === 'MPESA_SANDBOX' && !/^254\d{9}$/.test(phoneNumber)) {
      this.error.set('Enter a Kenyan mobile number, for example +254712345678 or 254712345678.');
      return;
    }
    this.busy.set(true); this.error.set('');
    const retry = this.isRetryablePayment(checkout.payment?.status);
    const key = this.paymentKey(checkout.id, retry);
    this.paymentKeys.set(checkout.id, key);
    this.checkoutApi.initiatePayment(checkout.id, this.paymentMethod(), key, phoneNumber)
      .pipe(
        tap(() => this.cart.paymentInitiated(checkout.id)),
        catchError((error) => {
          this.cart.restoreAfterPaymentFailure(checkout.id);
          this.showError(error, 'Payment could not be initiated. Your items have been restored to the cart.');
          return EMPTY;
        }),
        switchMap((result) => {
          this.checkout.set(result);
          return this.poll(checkout.id);
        }),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.checkout.set(result);
          if (result.payment?.method) this.paymentMethod.set(result.payment.method);
          if (result.payment?.status === 'FAILED' || result.payment?.status === 'CANCELLED' || result.payment?.status === 'TIMED_OUT') {
            this.cart.restoreAfterPaymentFailure(checkout.id);
          }
        },
        error: (error) => this.showError(error, 'Payment status could not be read. Refresh checkout before taking another action.'),
      });
  }

  protected refresh(): void {
    const checkout = this.checkout(); if (!checkout) return;
    this.busy.set(true);
    this.checkoutApi.get(checkout.id).subscribe({ next: (result) => { this.checkout.set(result); this.busy.set(false); if (this.isPendingPayment(result.payment?.status)) this.watchPayment(checkout.id); }, error: (error) => { this.busy.set(false); this.showError(error, 'Checkout could not be refreshed.'); } });
  }
  private loadCheckout(id: string): void {
    this.busy.set(true);
    this.checkoutApi.get(id).subscribe({
      next: (result) => { this.checkout.set(result); if (result.payment?.method) this.paymentMethod.set(result.payment.method); this.busy.set(false); if (this.isPendingPayment(result.payment?.status)) this.watchPayment(id); },
      error: (error) => { this.busy.set(false); this.showError(error, 'Checkout could not be loaded.'); },
    });
  }
  private poll(id: string) {
    return timer(0, 1000).pipe(switchMap(() => this.checkoutApi.get(id)), takeWhile((row) => this.isPendingPayment(row.payment?.status), true));
  }
  private watchPayment(id: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.poll(id).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (result) => { this.checkout.set(result); if (result.payment?.status === 'FAILED' || result.payment?.status === 'CANCELLED' || result.payment?.status === 'TIMED_OUT') this.cart.restoreAfterPaymentFailure(id); },
      error: (error) => this.showError(error, 'Payment status could not be read. Refresh checkout before taking another action.'),
    });
  }
  protected cancel(): void {
    const checkout = this.checkout(); if (!checkout || this.busy()) return;
    this.busy.set(true);
    this.checkoutApi.cancel(checkout.id).pipe(finalize(() => this.busy.set(false))).subscribe({ next: (result) => { this.checkout.set(result); this.cart.restoreAfterPaymentFailure(checkout.id); }, error: (error) => this.showError(error, 'Checkout could not be cancelled.') });
  }
  protected isRetryablePayment(status: CheckoutPaymentStatus | undefined): boolean {
    return status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT' || status === 'EXPIRED';
  }
  private isPendingPayment(status: CheckoutPaymentStatus | undefined): boolean {
    return status === 'PENDING' || status === 'INITIATED' || status === 'PROCESSING';
  }
  private isSuccessfulPayment(status: CheckoutPaymentStatus | undefined): boolean {
    return status === 'SUCCESS' || status === 'SUCCEEDED' || status === 'PAID';
  }
  protected paymentStatusLabel(): string {
    const status = this.checkout()?.payment?.status ?? (this.checkout()?.status === 'PAID' ? 'SUCCESS' : this.checkout()?.status === 'PAYMENT_FAILED' ? 'FAILED' : 'PENDING');
    return ({ PENDING: 'Waiting for payment', INITIATED: 'Waiting for payment', PROCESSING: 'Payment processing', SUCCESS: 'Payment successful', SUCCEEDED: 'Payment successful', PAID: 'Payment successful', FAILED: 'Payment failed', CANCELLED: 'Payment cancelled', TIMED_OUT: 'Payment timed out', EXPIRED: 'Payment expired', REVERSED: 'Payment reversed', REFUNDED: 'Payment refunded', UNKNOWN: 'Payment status unavailable' } as const)[status];
  }
  protected paymentReference(): string | null {
    const payment = this.checkout()?.payment;
    return payment?.paymentReference || payment?.reference || null;
  }
  protected canStartPayment(): boolean {
    const status = this.checkout()?.payment?.status;
    return !status || this.isRetryablePayment(status);
  }
  private paymentKey(checkoutId: string, retry = false): string {
    if (retry) {
      const key = globalThis.crypto.randomUUID();
      this.paymentKeys.set(checkoutId, key);
      sessionStorage.setItem(`logiflow.checkout.payment.${checkoutId}`, key);
      return key;
    }
    const cached = this.paymentKeys.get(checkoutId) ?? sessionStorage.getItem(`logiflow.checkout.payment.${checkoutId}`);
    if (cached) return cached;
    const key = globalThis.crypto.randomUUID();
    this.paymentKeys.set(checkoutId, key);
    sessionStorage.setItem(`logiflow.checkout.payment.${checkoutId}`, key);
    return key;
  }
  private showError(error: any, fallback: string): void { this.error.set(error?.error?.message ?? fallback); }
}
