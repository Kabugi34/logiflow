import { WarehouseOperationsService } from './warehouse-operations.service';
import {
  WarehouseInventorySource,
  WarehouseOrderSource,
  WarehouseReceiptSource,
} from './warehouse-operations.models';

describe('WarehouseOperationsService', () => {
  let service: WarehouseOperationsService;

  const inventory: WarehouseInventorySource[] = [
    { id: 'stock-1', sku: 'SKU-1', name: 'Rice', onHand: 20 },
    { id: 'stock-2', sku: 'SKU-2', name: 'Oil', onHand: 2 },
  ];
  const orders: WarehouseOrderSource[] = [
    {
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      lines: [{ sku: 'stock-1', product: 'Rice', quantity: 5 }],
    },
    {
      id: 'order-2',
      orderNumber: 'ORD-2',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      lines: [{ sku: 'SKU-2', product: 'Oil', quantity: 4 }],
    },
  ];
  const receipts: WarehouseReceiptSource[] = [
    {
      id: 'PO-1',
      status: 'IN_TRANSIT',
      lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 10 }],
    },
  ];

  beforeEach(() => {
    service = new WarehouseOperationsService();
    service.synchronize(inventory, orders, receipts);
  });

  it('only adds accepted quantities after a reconciled receipt is confirmed', () => {
    const receipt = service.receipts()[0];

    expect(() => service.receive(receipt.id, 8, 1, 0)).toThrow(/must equal the expected/);
    expect(service.stock().find((item) => item.sku === 'SKU-1')?.onHand).toBe(20);
    expect(service.receipts()[0].status).toBe('PENDING');

    service.receive(receipt.id, 7, 2, 1);

    expect(service.stock().find((item) => item.sku === 'SKU-1')?.onHand).toBe(27);
    expect(service.receipts()[0]).toMatchObject({
      status: 'RECEIVED',
      accepted: 7,
      damaged: 2,
      missing: 1,
    });
    expect(service.movements()[0]).toMatchObject({
      type: 'RECEIPT',
      quantity: 7,
      reference: 'PO-1',
    });
  });

  it('registers manual receipts against known products and validates reference and quantity', () => {
    expect(() => service.registerReceipt('   ', 'SKU-1', 1)).toThrow(
      /Delivery reference is required/,
    );
    expect(() => service.registerReceipt('DEL-1', 'UNKNOWN', 1)).toThrow(/current inventory/);
    expect(() => service.registerReceipt('DEL-1', 'SKU-1', 0)).toThrow(/positive whole number/);

    const receipt = service.registerReceipt('DEL-1', 'SKU-1', 3);
    expect(receipt).toMatchObject({
      reference: 'DEL-1',
      sku: 'SKU-1',
      expected: 3,
      status: 'PENDING',
    });
    expect(() => service.registerReceipt('DEL-1', 'SKU-1', 2)).toThrow(/already exists/);
  });

  it('rejects duplicate receipt confirmation and invalid quantities without changing state', () => {
    const receiptId = service.receipts()[0].id;
    service.receive(receiptId, 10, 0, 0);

    expect(() => service.receive(receiptId, 10, 0, 0)).toThrow(/no longer pending/);
    expect(() => service.adjust('SKU-1', 1.5, 'Count', 'Staff')).toThrow(/non-zero whole number/);
    expect(service.stock().find((item) => item.sku === 'SKU-1')?.onHand).toBe(30);
    expect(service.movements()).toHaveLength(1);
  });

  it('tracks put-away locations and prevents assigning more than unassigned stock', () => {
    service.putAway('SKU-1', 'A-01', 10, 'Warehouse staff');

    expect(service.stock().find((item) => item.sku === 'SKU-1')?.locations).toEqual({ 'A-01': 10 });
    expect(() => service.putAway('SKU-1', 'A-01', 11, 'Warehouse staff')).toThrow(
      /unassigned stock/,
    );
    expect(service.movements()[0]).toMatchObject({ type: 'PUT_AWAY', reference: 'PUT-1' });
  });

  it('allocates no more than available inventory and rejects picking beyond allocation', () => {
    const order = service.orders().find((item) => item.id === 'order-2')!;
    const line = order.lines[0];

    expect(line.allocated).toBe(2);
    expect(() => service.pick(order.id, line.id, 3, 'Warehouse staff')).toThrow(
      /exceeds allocated stock/,
    );
    expect(service.stock().find((item) => item.sku === 'SKU-2')?.staged).toBe(0);
    expect(service.orders().find((item) => item.id === order.id)?.status).toBe('AWAITING_PICK');
  });

  it('allocates received stock to a previously under-allocated order', () => {
    service.synchronize(
      [],
      [],
      [
        {
          id: 'PO-2',
          status: 'IN_TRANSIT',
          lines: [{ sku: 'SKU-2', product: 'Oil', quantity: 5 }],
        },
      ],
    );
    const receipt = service.receipts().find((item) => item.reference === 'PO-2')!;
    service.receive(receipt.id, 5, 0, 0);

    const order = service.orders().find((item) => item.id === 'order-2')!;
    expect(order.lines[0].allocated).toBe(4);
    expect(service.stock().find((item) => item.sku === 'SKU-2')?.allocated).toBe(4);
    service.pick(order.id, order.lines[0].id, 4, 'Picker');
    expect(service.orders().find((item) => item.id === order.id)?.status).toBe('READY_TO_PACK');
  });

  it('creates fulfillment work from accepted manufacturer purchase orders', () => {
    service.synchronize(
      [],
      [
        {
          id: 'accepted-po',
          orderNumber: 'MPO-1',
          status: 'ACCEPTED',
          paymentStatus: 'PAID',
          lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 3 }],
        },
      ],
      [],
    );

    expect(service.orders().map((order) => order.orderNumber)).toContain('MPO-1');
    expect(
      service.orders().find((order) => order.orderNumber === 'MPO-1')?.lines[0].allocated,
    ).toBe(3);
  });

  it('does not allocate manufacturer orders unless payment is verified as paid', () => {
    service.synchronize(
      [],
      [
        {
          id: 'unpaid-po',
          orderNumber: 'MPO-UNPAID',
          status: 'ACCEPTED',
          paymentStatus: 'UNKNOWN',
          lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 3 }],
        },
        {
          id: 'failed-po',
          orderNumber: 'MPO-FAILED',
          status: 'ACCEPTED',
          paymentStatus: 'FAILED',
          lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 2 }],
        },
      ],
      [],
    );

    expect(service.orders().map((order) => order.id)).not.toContain('unpaid-po');
    expect(service.orders().map((order) => order.id)).not.toContain('failed-po');
    expect(service.stock().find((item) => item.sku === 'SKU-1')?.allocated).toBe(5);
  });

  it('only creates incoming receipt work for shipped stock, not an approved purchase order', () => {
    service.synchronize(
      [],
      [],
      [
        {
          id: 'approved-po',
          status: 'PROCESSING',
          lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 8 }],
        },
        {
          id: 'shipped-po',
          status: 'IN_TRANSIT',
          lines: [{ sku: 'SKU-1', product: 'Rice', quantity: 3 }],
        },
      ],
    );

    expect(service.receipts().map((receipt) => receipt.reference)).toContain('shipped-po');
    expect(service.receipts().map((receipt) => receipt.reference)).not.toContain('approved-po');
  });

  it('moves an order through picking and packing only with complete quantities', () => {
    const order = service.orders().find((item) => item.id === 'order-1')!;
    const line = order.lines[0];

    expect(() => service.pack(order.id, { [line.id]: 5 }, 1)).toThrow(/All requested items/);
    service.pick(order.id, line.id, 2, 'Picker');
    expect(service.orders().find((item) => item.id === order.id)?.status).toBe('PICKING');
    service.pick(order.id, line.id, 3, 'Picker');
    expect(service.orders().find((item) => item.id === order.id)?.status).toBe('READY_TO_PACK');

    expect(() => service.pack(order.id, { [line.id]: 4 }, 1)).toThrow(
      /must match the picked quantities/,
    );
    service.pack(order.id, { [line.id]: 5 }, 2);

    expect(service.orders().find((item) => item.id === order.id)).toMatchObject({
      status: 'READY_TO_DISPATCH',
      packages: 2,
      lines: [{ packed: 5 }],
    });
  });

  it('deducts dispatch stock once, records its trip reference, and rejects duplicate dispatch', () => {
    const order = service.orders().find((item) => item.id === 'order-1')!;
    const line = order.lines[0];
    expect(() =>
      service.dispatchOrders(['order-2'], {
        tripId: 'trip-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        user: 'Dispatcher',
      }),
    ).toThrow(/ready for dispatch/);
    service.pick(order.id, line.id, 5, 'Picker');
    service.pack(order.id, { [line.id]: 5 }, 1);

    const dispatch = () =>
      service.dispatchOrders([order.id], {
        tripId: 'trip-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        user: 'Dispatcher',
      });
    dispatch();

    expect(service.stock().find((item) => item.sku === 'SKU-1')).toMatchObject({
      onHand: 15,
      allocated: 0,
      staged: 0,
    });
    expect(service.orders().find((item) => item.id === order.id)).toMatchObject({
      status: 'DISPATCHED',
      tripId: 'trip-1',
      vehicleId: 'vehicle-1',
      driverId: 'driver-1',
    });
    expect(service.movements()[0]).toMatchObject({
      type: 'DISPATCH',
      quantity: -5,
      reference: 'trip-1',
    });

    expect(dispatch).toThrow(/ready for dispatch/);
    expect(service.stock().find((item) => item.sku === 'SKU-1')?.onHand).toBe(15);
    expect(service.movements().filter((movement) => movement.type === 'DISPATCH')).toHaveLength(1);
  });

  it('requires a valid adjustment reason and actor and protects allocated stock', () => {
    expect(() => service.adjust('SKU-1', -16, 'Count discrepancy', 'Auditor')).toThrow(
      /below allocated or picked quantities/,
    );
    expect(() => service.adjust('SKU-1', -1, '   ', 'Auditor')).toThrow(/reason is required/);
    expect(() => service.adjust('SKU-1', 1, 'Count correction', '')).toThrow(/responsible user/);

    service.adjust('SKU-1', -1, 'Damaged during count', 'Auditor');
    expect(service.stock().find((item) => item.sku === 'SKU-1')?.onHand).toBe(19);
    expect(service.movements()[0]).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: -1,
      reason: 'Damaged during count',
      user: 'Auditor',
      reference: 'ADJ-1',
    });
  });
});
