import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, exhaustMap, finalize, takeUntil, takeWhile, tap, timer } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly checkout = signal<CheckoutResponse | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly polling = signal(false);
  protected readonly pollingTimedOut = signal(false);
  protected readonly paymentMethod = signal<CheckoutPaymentMethod>('MPESA_SANDBOX');
  protected readonly paymentPhone = signal('');
  private readonly createKey = signal(globalThis.crypto.randomUUID());
  private readonly paymentKeys = new Map<string, string>();
  private readonly stopPolling = new Subject<void>();
  private pollingCheckoutId: string | null = null;

  protected readonly cartRows = computed(() => this.cart.lines().map((line) => ({
    line,
    product: this.procurement.checkoutProducts().find((row) => row.productId === line.productId),
  })));
  protected readonly invalidCartRows = computed(() => this.cartRows().filter(({ line, product }) =>
    line.quantity < 1 || !product || product.inStock === false || product.availableQuantity === 0 ||
    (product.availableQuantity !== null && line.quantity > product.availableQuantity),
  ));
  protected readonly suppliers = computed(() => {
    const rows = this.cartRows().filter(({ product }) => !!product);
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
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
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
    if (this.isPendingPayment(checkout.payment?.status)) { this.refresh(); return; }
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
        takeUntilDestroyed(this.destroyRef),
        catchError((error) => {
          this.showError(error, 'Payment could not be initiated. Refresh checkout to confirm its current state.');
          return EMPTY;
        }),
        tap((result) => {
          this.checkout.set(result);
          this.paymentMethod.set(result.payment?.method === 'MPESA' ? 'MPESA_SANDBOX' : result.payment?.method ?? this.paymentMethod());
          this.pollingTimedOut.set(false);
          if (result.payment && !result.payment.terminal) this.watchPayment(checkout.id);
        }),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.checkout.set(result);
          if (result.payment?.method) this.paymentMethod.set(result.payment.method === 'MPESA' ? 'MPESA_SANDBOX' : result.payment.method);
          if (result.payment?.terminal && this.isFailedPayment(result.payment.status)) this.cart.restoreAfterPaymentFailure(checkout.id);
        },
        error: (error) => this.showError(error, 'Payment status could not be read. Refresh checkout before taking another action.'),
      });
  }

  protected refresh(): void {
    const checkout = this.checkout(); if (!checkout) return;
    this.stopCurrentPolling();
    this.busy.set(true);
    this.checkoutApi.get(checkout.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (result) => { this.checkout.set(result); this.busy.set(false); this.pollingTimedOut.set(false); if (result.payment?.method) this.paymentMethod.set(result.payment.method === 'MPESA' ? 'MPESA_SANDBOX' : result.payment.method); if (result.payment && !result.payment.terminal) this.watchPayment(checkout.id); else if (result.payment?.terminal && this.isFailedPayment(result.payment.status)) this.cart.restoreAfterPaymentFailure(checkout.id); else if (result.payment?.terminal && this.isSuccessfulPayment(result.payment.status)) this.cart.paymentInitiated(checkout.id); }, error: (error) => { this.busy.set(false); this.showError(error, 'Checkout could not be refreshed.'); } });
  }
  private loadCheckout(id: string): void {
    this.busy.set(true);
    this.checkoutApi.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.checkout.set(result); if (result.payment?.method) this.paymentMethod.set(result.payment.method === 'MPESA' ? 'MPESA_SANDBOX' : result.payment.method); this.busy.set(false); if (result.payment && !result.payment.terminal) this.watchPayment(id); else if (result.payment?.terminal && this.isFailedPayment(result.payment.status)) this.cart.restoreAfterPaymentFailure(id); else if (result.payment?.terminal && this.isSuccessfulPayment(result.payment.status)) this.cart.paymentInitiated(id); },
      error: (error) => { this.busy.set(false); this.showError(error, 'Checkout could not be loaded.'); },
    });
  }
  private watchPayment(id: string): void {
    if (this.pollingCheckoutId === id) return;
    this.stopCurrentPolling();
    this.pollingCheckoutId = id;
    this.polling.set(true);
    this.pollingTimedOut.set(false);
    let terminalOrTimedOut = false;
    let deadlineElapsed = false;
    timer(3000, 3000).pipe(
      exhaustMap(() => this.checkoutApi.get(id)),
      takeWhile((row) => !!row.payment && !row.payment.terminal, true),
      takeUntil(timer(120_000).pipe(tap(() => { deadlineElapsed = true; }))),
      takeUntil(this.stopPolling),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.polling.set(false);
        this.pollingCheckoutId = null;
        if (deadlineElapsed && !terminalOrTimedOut && this.checkout()?.id === id && this.isPendingPayment(this.checkout()?.payment?.status)) this.pollingTimedOut.set(true);
      }),
    ).subscribe({
      next: (result) => {
        this.checkout.set(result);
        if (result.payment?.method) this.paymentMethod.set(result.payment.method === 'MPESA' ? 'MPESA_SANDBOX' : result.payment.method);
        if (result.payment?.terminal) {
          terminalOrTimedOut = true;
          this.pollingTimedOut.set(false);
          if (this.isFailedPayment(result.payment?.status)) this.cart.restoreAfterPaymentFailure(id);
          else if (this.isSuccessfulPayment(result.payment?.status)) this.cart.paymentInitiated(id);
        }
      },
      error: (error) => this.showError(error, 'Payment status could not be read. Refresh checkout before taking another action.'),
    });
  }
  protected cancel(): void {
    const checkout = this.checkout(); if (!checkout || this.busy()) return;
    this.busy.set(true);
    this.checkoutApi.cancel(checkout.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({ next: (result) => { this.checkout.set(result); if (result.payment?.terminal && this.isFailedPayment(result.payment.status)) this.cart.restoreAfterPaymentFailure(checkout.id); }, error: (error) => this.showError(error, 'Checkout could not be cancelled.') });
  }
  protected isRetryablePayment(status: CheckoutPaymentStatus | undefined): boolean {
    return this.checkout()?.payment?.retryAllowed === true && (status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT');
  }
  private isFailedPayment(status: CheckoutPaymentStatus | undefined): boolean {
    return status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT';
  }
  private isPendingPayment(status: CheckoutPaymentStatus | undefined): boolean {
    return status === 'PENDING' || status === 'UNKNOWN';
  }
  private isSuccessfulPayment(status: CheckoutPaymentStatus | undefined): boolean {
    return status === 'SUCCESS';
  }
  protected paymentStatusLabel(): string {
    const status = this.checkout()?.payment?.status ?? (this.checkout()?.status === 'PAID' ? 'SUCCESS' : this.checkout()?.status === 'PAYMENT_FAILED' ? 'FAILED' : 'UNKNOWN');
    return ({ PENDING: 'Waiting for payment confirmation', SUCCESS: 'Payment successful', FAILED: 'Payment failed', CANCELLED: 'STK request cancelled', TIMED_OUT: 'Payment timed out', UNKNOWN: 'Payment confirmation status unknown' } as const)[status];
  }
  protected statusMessage(): string | null {
    const payment = this.checkout()?.payment;
    if (this.pollingTimedOut() && this.isPendingPayment(payment?.status)) {
      return 'Payment confirmation is still pending. Automatic checks have stopped; refresh status to check again. This does not mean the payment failed.';
    }
    return payment?.userMessage || payment?.customerMessage || payment?.failureReason || null;
  }
  protected paymentReference(): string | null {
    const payment = this.checkout()?.payment;
    return payment?.paymentReference || payment?.reference || null;
  }
  protected isMpesaPayment(): boolean {
    const method = this.checkout()?.payment?.method;
    return method === 'MPESA' || method === 'MPESA_SANDBOX';
  }
  protected canStartPayment(): boolean {
    const status = this.checkout()?.payment?.status;
    return !status || this.isRetryablePayment(status);
  }
  private stopCurrentPolling(): void {
    if (!this.pollingCheckoutId) return;
    this.stopPolling.next();
    this.pollingCheckoutId = null;
    this.polling.set(false);
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
