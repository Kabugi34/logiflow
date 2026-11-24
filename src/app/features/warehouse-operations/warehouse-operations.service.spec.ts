import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { WarehouseOperationsService } from './warehouse-operations.service';

describe('WarehouseOperationsService', () => {
  let service: WarehouseOperationsService;
  let getResponses: Map<string, unknown>;
  let postResponses: Map<string, unknown>;
  let postErrors: Map<string, unknown>;
  let getCalls: string[];
  let postCalls: { url: string; body: unknown }[];

  const stockId = 'stock-uuid-1';
  const orderId = 'order-uuid-1';
  const orderItemId = 'order-item-uuid-1';
  const shipmentId = 'shipment-uuid-1';
  const purchaseOrderItemId = 'purchase-order-item-uuid-1';

  beforeEach(() => {
    getResponses = new Map();
    postResponses = new Map();
    postErrors = new Map();
    getCalls = [];
    postCalls = [];
    const http = {
      get: (url: string) => {
        getCalls.push(url);
        const response = getResponses.get(url) ??
          (url.includes('/movements?') ? { content: [] } : []);
        return of(response);
      },
      post: (url: string, body: unknown) => {
        postCalls.push({ url, body });
        const error = postErrors.get(url);
        if (error) return throwError(() => error);
        return of(postResponses.get(url) ?? {});
      },
    };
    service = new WarehouseOperationsService(http as unknown as HttpClient);
  });

  function synchronizeDistributor(): void {
    service.synchronize(
      [{ id: stockId, sku: 'SKU-1', name: 'Rice', onHand: 20 }],
      [
        {
          id: orderId,
          orderNumber: 'ORD-1',
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          lines: [
            {
              orderItemId,
              stockItemId: stockId,
              sku: 'SKU-1',
              product: 'Rice',
              quantity: 5,
              pickedQuantity: 0,
              packedQuantity: 0,
            },
          ],
        },
      ],
      'DISTRIBUTOR',
    );
  }

  it('loads persisted shipment receipts and posts every canonical line only on confirmation', () => {
    getResponses.set(API_ENDPOINTS.warehouseOperations.shipments, {
      content: [
        {
          id: shipmentId,
          purchaseOrderNumber: 'PO-42',
          status: 'DELIVERED',
          receiptLines: [
            {
              purchaseOrderItemId,
              stockItemId: stockId,
              productName: 'Rice',
              expectedQuantity: 8,
            },
          ],
        },
      ],
    });
    service.loadShipments();

    expect(service.receipts()[0]).toMatchObject({
      shipmentId,
      reference: 'PO-42',
      status: 'PENDING',
      shipmentStatus: 'DELIVERED',
      lines: [{ purchaseOrderItemId, expected: 8 }],
    });

    const receiveUrl = API_ENDPOINTS.warehouseOperations.receiveShipment(shipmentId);
    const payload = {
      note: 'One damaged bag',
      lines: [
        {
          purchaseOrderItemId,
          acceptedQuantity: 6,
          damagedQuantity: 1,
          missingQuantity: 1,
        },
      ],
    };
    postResponses.set(receiveUrl, {
      id: shipmentId,
      purchaseOrderNumber: 'PO-42',
      status: 'RECEIVED',
      receiptLines: [
        {
          purchaseOrderItemId,
          stockItemId: stockId,
          productName: 'Rice',
          expectedQuantity: 8,
          acceptedQuantity: 6,
          damagedQuantity: 1,
          missingQuantity: 1,
        },
      ],
    });
    service.receiveShipment(shipmentId, payload).subscribe();

    expect(postCalls.at(-1)).toEqual({ url: receiveUrl, body: payload });
    expect(service.receipts()[0]).toMatchObject({
      status: 'RECEIVED',
      accepted: 6,
      damaged: 1,
      missing: 1,
    });
  });

  it('loads persisted locations and server movement values for canonical stock IDs', () => {
    const locationsUrl = API_ENDPOINTS.warehouseOperations.stockItemLocations(stockId);
    const movementsUrl = `${API_ENDPOINTS.warehouseOperations.stockItemMovements(stockId)}?size=100`;
    getResponses.set(locationsUrl, [
      { id: 'location-uuid', stockItemId: stockId, sku: 'SKU-1', locationCode: 'A-01', quantity: 8 },
    ]);
    getResponses.set(movementsUrl, {
      content: [
        {
          id: 'movement-uuid',
          stockItemId: stockId,
          movementType: 'RESTOCK_IN',
          quantityDelta: 8,
          referenceType: 'PURCHASE_ORDER_SHIPMENT',
          referenceId: shipmentId,
          performedBy: 'user-uuid',
          note: 'Received',
          createdAt: '2026-01-01T10:00:00Z',
        },
      ],
    });
    service.synchronize(
      [{ id: stockId, sku: 'SKU-1', name: 'Rice', onHand: 20 }],
      [],
      'DISTRIBUTOR',
    );

    expect(getCalls).toContain(locationsUrl);
    expect(service.stock()[0]).toMatchObject({ id: stockId, locations: { 'A-01': 8 } });
    expect(service.movements()[0]).toMatchObject({
      id: 'movement-uuid',
      type: 'RESTOCK_IN',
      quantity: 8,
      reference: `PURCHASE_ORDER_SHIPMENT · ${shipmentId}`,
      user: 'user-uuid',
    });
  });

  it('sends a backend-supported adjustment enum and updates movement state after success', () => {
    synchronizeDistributor();
    const url = API_ENDPOINTS.warehouseOperations.stockItemMovements(stockId);
    postResponses.set(url, {
      id: 'adjustment-uuid',
      stockItemId: stockId,
      movementType: 'ADJUSTMENT',
      quantityDelta: -2,
      note: 'Damaged in storage',
      performedBy: 'user-uuid',
      createdAt: '2026-01-01T10:00:00Z',
    });
    service.adjustStock(stockId, -2, 'Damaged in storage').subscribe();

    expect(postCalls.at(-1)).toEqual({
      url,
      body: {
        movementType: 'ADJUSTMENT',
        quantityDelta: -2,
        note: 'Damaged in storage',
      },
    });
    expect(service.movements()[0]).toMatchObject({
      id: 'adjustment-uuid',
      type: 'ADJUSTMENT',
      quantity: -2,
      reason: 'Damaged in storage',
    });
    expect(service.stock()[0].onHand).toBe(20);
  });

  it('posts the cumulative picked quantity with the canonical order-item ID and maps success', () => {
    synchronizeDistributor();
    const url = API_ENDPOINTS.warehouseOperations.orderPick(orderId);
    postResponses.set(url, {
      id: orderId,
      orderNumber: 'ORD-1',
      status: 'PROCESSING',
      packageCount: 0,
      items: [
        {
          id: orderItemId,
          stockItemId: stockId,
          quantity: 5,
          pickedQuantity: 2,
          packedQuantity: 0,
        },
      ],
    });
    service.pickOrderItem(orderId, orderItemId, 2).subscribe();

    expect(postCalls.at(-1)).toEqual({
      url,
      body: { orderItemId, pickedQuantity: 2 },
    });
    expect(service.orders()[0]).toMatchObject({
      status: 'PICKING',
      lines: [{ orderItemId, picked: 2 }],
    });
    expect(service.stock()[0].onHand).toBe(20);
  });

  it('posts package count and reflects the backend order response after success', () => {
    synchronizeDistributor();
    const pickUrl = API_ENDPOINTS.warehouseOperations.orderPick(orderId);
    postResponses.set(pickUrl, {
      id: orderId,
      orderNumber: 'ORD-1',
      status: 'READY_TO_PACK',
      packageCount: 0,
      items: [
        {
          id: orderItemId,
          stockItemId: stockId,
          quantity: 5,
          pickedQuantity: 5,
          packedQuantity: 0,
        },
      ],
    });
    service.pickOrderItem(orderId, orderItemId, 5).subscribe();

    const packUrl = API_ENDPOINTS.warehouseOperations.orderPack(orderId);
    postResponses.set(packUrl, {
      id: orderId,
      orderNumber: 'ORD-1',
      status: 'AWAITING_DISPATCH',
      packageCount: 2,
      items: [
        {
          id: orderItemId,
          stockItemId: stockId,
          quantity: 5,
          pickedQuantity: 5,
          packedQuantity: 5,
        },
      ],
    });
    service.packOrder(orderId, 2).subscribe();

    expect(postCalls.at(-1)).toEqual({ url: packUrl, body: { packageCount: 2 } });
    expect(service.orders()[0]).toMatchObject({
      status: 'READY_TO_DISPATCH',
      packages: 2,
      lines: [{ packed: 5 }],
    });
  });

  it('refuses order actions when only synthetic UI line IDs are available', () => {
    service.synchronize(
      [{ id: stockId, sku: 'SKU-1', name: 'Rice', onHand: 20 }],
      [
        {
          id: orderId,
          orderNumber: 'PO-1',
          status: 'ACCEPTED',
          paymentStatus: 'PAID',
          lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 2 }],
        },
      ],
      'MANUFACTURER',
    );

    expect(service.orders()[0].lines[0].id).toBe(`${orderId}:0`);
    expect(service.orders()[0].status).toBe('READY_TO_DISPATCH');
    expect(() => service.pickOrderItem(orderId, `${orderId}:0`, 1)).toThrow(
      /canonical order-item ID/,
    );
  });

  it('marks accepted manufacturer purchase orders ready for dispatch only after verified payment', () => {
    service.synchronize(
      [{ id: stockId, sku: 'SKU-1', name: 'Rice', onHand: 5 }],
      [
        {
          id: 'paid-po', orderNumber: 'PO-PAID', status: 'ACCEPTED', paymentStatus: 'PAID',
          lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 2 }],
        },
        {
          id: 'pending-po', orderNumber: 'PO-PENDING', status: 'ACCEPTED', paymentStatus: 'PENDING',
          lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 2 }],
        },
      ],
      'MANUFACTURER',
    );

    expect(service.readyToDispatch().map((order) => order.id)).toEqual(['paid-po']);
  });

  it('gates warehouse work on verified payment and allocates no more than available stock', () => {
    service.synchronize(
      [{ id: stockId, sku: 'SKU-1', name: 'Rice', onHand: 5 }],
      [
        {
          id: 'paid-order',
          orderNumber: 'ORD-PAID',
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          lines: [
            {
              orderItemId: 'paid-item',
              stockItemId: stockId,
              sku: 'SKU-1',
              product: 'Rice',
              quantity: 4,
            },
          ],
        },
        {
          id: 'unpaid-order',
          orderNumber: 'ORD-UNPAID',
          status: 'CONFIRMED',
          paymentStatus: 'PENDING',
          lines: [
            {
              orderItemId: 'unpaid-item',
              stockItemId: stockId,
              sku: 'SKU-1',
              product: 'Rice',
              quantity: 4,
            },
          ],
        },
        {
          id: 'second-paid-order',
          orderNumber: 'ORD-SECOND',
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          lines: [
            {
              orderItemId: 'second-item',
              stockItemId: stockId,
              sku: 'SKU-1',
              product: 'Rice',
              quantity: 4,
            },
          ],
        },
      ],
      'DISTRIBUTOR',
    );

    expect(service.orders().map((order) => order.id)).toEqual([
      'paid-order',
      'second-paid-order',
    ]);
    expect(service.orders().map((order) => order.lines[0].allocated)).toEqual([4, 1]);
    expect(service.stock()[0].allocated).toBe(5);
  });

  it('rejects dispatch validation until every order is backend-ready', () => {
    synchronizeDistributor();
    expect(() => service.validateDispatchOrders([orderId])).toThrow(
      /ready for dispatch/,
    );

    const stock = [
      { id: stockId, sku: 'SKU-1', name: 'Rice', onHand: 20 },
    ];
    service.synchronize(
      stock,
      [
        {
          id: orderId,
          orderNumber: 'ORD-1',
          status: 'AWAITING_DISPATCH',
          paymentStatus: 'PAID',
          lines: [
            {
              orderItemId,
              stockItemId: stockId,
              sku: 'SKU-1',
              product: 'Rice',
              quantity: 5,
              pickedQuantity: 5,
              packedQuantity: 5,
            },
          ],
        },
      ],
      'DISTRIBUTOR',
    );
    expect(() => service.validateDispatchOrders([orderId])).not.toThrow();
  });

  it('does not mark a receipt complete when the backend rejects confirmation', () => {
    const receiveUrl = API_ENDPOINTS.warehouseOperations.receiveShipment(shipmentId);
    getResponses.set(API_ENDPOINTS.warehouseOperations.shipments, {
      content: [
        {
          id: shipmentId,
          purchaseOrderNumber: 'PO-42',
          status: 'DELIVERED',
          receiptLines: [
            {
              purchaseOrderItemId,
              stockItemId: stockId,
              productName: 'Rice',
              expectedQuantity: 8,
            },
          ],
        },
      ],
    });
    service.loadShipments();
    postErrors.set(receiveUrl, new Error('Rejected by server'));
    let failed = false;
    service
      .receiveShipment(shipmentId, {
        lines: [
          {
            purchaseOrderItemId,
            acceptedQuantity: 8,
            damagedQuantity: 0,
            missingQuantity: 0,
          },
        ],
      })
      .subscribe({ error: () => (failed = true) });

    expect(failed).toBe(true);
    expect(service.receipts()[0].status).toBe('PENDING');
  });

  it('rejects invalid adjustments before calling the backend', () => {
    synchronizeDistributor();
    expect(() => service.adjustStock(stockId, 0, 'Correction')).toThrow(
      /non-zero whole number/,
    );
    expect(() => service.adjustStock(stockId, 1, '  ')).toThrow(/reason is required/);
    expect(postCalls).toEqual([]);
  });
});
