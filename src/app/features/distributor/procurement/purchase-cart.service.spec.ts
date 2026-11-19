import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { DistributorPurchaseCartService, PurchaseCartLine } from './purchase-cart.service';

const ORGANIZATION_ID = 'cart-test-distributor';
const STORAGE_KEY_V2 = `logiflow.distributor.purchaseCart.v2.${ORGANIZATION_ID}`;
const STORAGE_KEY = `logiflow.distributor.purchaseCart.v1.${ORGANIZATION_ID}`;

function line(productId: string, supplierOrganizationId = 'supplier-a'): PurchaseCartLine {
  return { productId, stockItemId: `stock-${productId}`, supplierOrganizationId, supplierName: supplierOrganizationId, name: `Product ${productId}`, sku: `SKU-${productId}`, quantity: 1 };
}

describe('DistributorPurchaseCartService', () => {
  let cart: DistributorPurchaseCartService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_V2);
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user: signal({ organization: { id: ORGANIZATION_ID } }) } }] });
    cart = TestBed.inject(DistributorPurchaseCartService);
  });

  afterEach(() => { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY_V2); TestBed.resetTestingModule(); });

  it('adds only selected products and groups mixed suppliers without duplicates', () => {
    cart.add(line('one'));
    expect(cart.lines().map((item) => item.productId)).toEqual(['one']);
    cart.add(line('two', 'supplier-b'));
    cart.add(line('one'));
    expect(cart.lines().map((item) => [item.productId, item.supplierOrganizationId, item.quantity])).toEqual([
      ['one', 'supplier-a', 2], ['two', 'supplier-b', 1],
    ]);
  });

  it('updates quantities, removes items, and restores a submitted cart after payment initiation fails', () => {
    cart.add(line('one'));
    cart.add(line('two'));
    cart.setQuantity('one', 4);
    cart.remove('two');
    cart.checkoutCreated('checkout-1', ['one']);
    expect(cart.lines()).toEqual([]);
    cart.restoreAfterPaymentFailure('checkout-1');
    expect(cart.lines()).toEqual([expect.objectContaining({ productId: 'one', quantity: 4 })]);
  });

  it('persists cart lines and warehouse selections across service reloads', () => {
    cart.add(line('one'));
    cart.setWarehouse('supplier-a', 'warehouse-1');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user: signal({ organization: { id: ORGANIZATION_ID } }) } }] });
    const reloaded = TestBed.inject(DistributorPurchaseCartService);
    expect(reloaded.lines()).toEqual([expect.objectContaining({ productId: 'one', quantity: 1 })]);
    expect(reloaded.warehouse('supplier-a')).toBe('warehouse-1');
  });
});
