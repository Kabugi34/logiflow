import { computed, Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';

export interface PurchaseCartLine {
  productId: string;
  stockItemId: string;
  supplierOrganizationId: string;
  supplierName: string;
  name: string;
  sku: string;
  quantity: number;
}

interface PersistedCart { lines: PurchaseCartLine[]; recovery: Record<string, PurchaseCartLine[]>; warehouses: Record<string, string>; }
const CART_KEY_PREFIX = 'logiflow.distributor.purchaseCart.v2';
const LEGACY_CART_KEY_PREFIX = 'logiflow.distributor.purchaseCart.v1';

@Injectable({ providedIn: 'root' })
export class DistributorPurchaseCartService {
  private readonly auth = inject(AuthService);
  private loadedKey = '';
  private readonly state = signal<PersistedCart>({ lines: [], recovery: {}, warehouses: {} });
  readonly lines = computed(() => this.state().lines);

  constructor() { this.load(); }

  warehouse(supplierId: string): string { this.load(); return this.state().warehouses[supplierId] ?? ''; }
  setWarehouse(supplierId: string, warehouseId: string): void {
    this.load(); this.save({ ...this.state(), warehouses: { ...this.state().warehouses, [supplierId]: warehouseId } });
  }

  add(line: PurchaseCartLine): void {
    this.load();
    const lines = this.state().lines;
    const existing = lines.find((item) => item.productId === line.productId && item.supplierOrganizationId === line.supplierOrganizationId);
    this.save({ ...this.state(), lines: existing
      ? lines.map((item) => item === existing ? { ...item, quantity: item.quantity + line.quantity } : item)
      : [...lines, line] });
  }

  setQuantity(productId: string, quantity: number): void {
    this.load();
    this.save({ ...this.state(), lines: this.state().lines.map((line) => line.productId === productId ? { ...line, quantity } : line) });
  }

  remove(productId: string): void {
    this.load();
    this.save({ ...this.state(), lines: this.state().lines.filter((line) => line.productId !== productId) });
  }

  checkoutCreated(checkoutId: string, purchasedProductIds: string[]): void {
    this.load();
    const selected = this.state().lines.filter((line) => purchasedProductIds.includes(line.productId));
    const recovery = { ...this.state().recovery, [checkoutId]: selected };
    this.save({ ...this.state(), lines: this.state().lines.filter((line) => !purchasedProductIds.includes(line.productId)), recovery });
  }

  paymentInitiated(checkoutId: string): void {
    this.load();
    const recovery = { ...this.state().recovery };
    delete recovery[checkoutId];
    this.save({ ...this.state(), recovery });
  }

  restoreAfterPaymentFailure(checkoutId: string): void {
    this.load();
    const recovery = { ...this.state().recovery };
    const purchased = recovery[checkoutId] ?? [];
    delete recovery[checkoutId];
    const lines = [...this.state().lines];
    for (const line of purchased) {
      const existingIndex = lines.findIndex((item) => item.productId === line.productId && item.supplierOrganizationId === line.supplierOrganizationId);
      if (existingIndex < 0) lines.push(line);
      else lines[existingIndex] = { ...lines[existingIndex], quantity: lines[existingIndex].quantity + line.quantity };
    }
    this.save({ ...this.state(), lines, recovery });
  }

  private load(): void {
    const organizationId = this.auth.user()?.organization.id;
    const key = `${CART_KEY_PREFIX}.${organizationId ?? 'current'}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    try {
      const parsed = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
      const legacyParsed = !parsed && typeof localStorage !== 'undefined'
        ? localStorage.getItem(`${LEGACY_CART_KEY_PREFIX}.${organizationId ?? 'current'}`)
        : null;
      const value = (parsed ?? legacyParsed) ? JSON.parse(parsed ?? legacyParsed!) as PersistedCart : null;
      const migratingLegacyCart = !parsed && !!legacyParsed;
      this.state.set({
        lines: Array.isArray(value?.lines) ? value!.lines.filter((line) => !!line?.productId && Number.isInteger(line.quantity) && line.quantity >= 0)
          .map((line) => migratingLegacyCart ? { ...line, quantity: 0 } : line) : [],
        recovery: value?.recovery && typeof value.recovery === 'object' ? value.recovery : {},
        warehouses: value?.warehouses && typeof value.warehouses === 'object' ? value.warehouses : {},
      });
      if (migratingLegacyCart) this.save(this.state());
    } catch { this.state.set({ lines: [], recovery: {}, warehouses: {} }); }
  }

  private save(state: PersistedCart): void {
    this.state.set(state);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(this.loadedKey, JSON.stringify(state)); } catch { /* Cart remains available for this app session. */ }
  }
}
