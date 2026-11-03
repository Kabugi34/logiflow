import { computed, Injectable, signal } from '@angular/core';
import {
  WarehouseInventorySource,
  WarehouseLine,
  WarehouseMovement,
  WarehouseOrder,
  WarehouseOrderSource,
  WarehouseReceipt,
  WarehouseReceiptSource,
  WarehouseStock,
} from './warehouse-operations.models';

interface WarehouseState {
  receipts: WarehouseReceipt[];
  orders: WarehouseOrder[];
  stock: WarehouseStock[];
  movements: WarehouseMovement[];
  nextMovementNumber: number;
}

interface DispatchOptions {
  tripId: string;
  vehicleId: string;
  driverId: string;
  user: string;
}

interface PreparedDispatch {
  state: WarehouseState;
  ids: string[];
  selected: WarehouseOrder[];
  quantities: Map<string, number>;
  tripId: string;
  vehicleId: string;
  driverId: string;
  user: string;
}

/** Local operations repository for workflows without backend contracts. */
@Injectable()
export class WarehouseOperationsService {
  private readonly warehouseState = signal<WarehouseState>({
    receipts: [],
    orders: [],
    stock: [],
    movements: [],
    nextMovementNumber: 1,
  });

  readonly receipts = computed(() => this.warehouseState().receipts);
  readonly orders = computed(() => this.warehouseState().orders);
  readonly stock = computed(() => this.warehouseState().stock);
  readonly movements = computed(() => this.warehouseState().movements);
  readonly initialized = signal(false);
  readonly sourceWarnings = signal<string[]>([]);
  readonly pendingReceipts = computed(() =>
    this.receipts().filter((receipt) => receipt.status === 'PENDING'),
  );
  readonly awaitingPick = computed(() =>
    this.orders().filter((order) => ['AWAITING_PICK', 'PICKING'].includes(order.status)),
  );
  readonly readyToPack = computed(() =>
    this.orders().filter((order) => order.status === 'READY_TO_PACK'),
  );
  readonly readyToDispatch = computed(() =>
    this.orders().filter((order) => order.status === 'READY_TO_DISPATCH'),
  );

  registerReceipt(reference: string, sku: string, expected: number): WarehouseReceipt {
    this.positive(expected);
    const cleanReference = reference.trim();
    if (!cleanReference) throw new Error('Delivery reference is required.');
    const state = this.warehouseState();
    const item = state.stock.find((row) => row.sku === sku);
    if (!item) throw new Error('Select a product from the current inventory.');
    if (
      state.receipts.some(
        (receipt) =>
          receipt.reference === cleanReference &&
          receipt.sku === sku &&
          receipt.status === 'PENDING',
      )
    ) {
      throw new Error('A pending receipt already exists for this product and delivery reference.');
    }

    const receipt: WarehouseReceipt = {
      id: `${cleanReference}:MANUAL:${state.nextMovementNumber}`,
      reference: cleanReference,
      sku,
      product: item.product,
      expected,
      status: 'PENDING',
    };
    this.warehouseState.set({ ...state, receipts: [receipt, ...state.receipts] });
    return receipt;
  }

  synchronize(
    inventory: WarehouseInventorySource[],
    sourceOrders: WarehouseOrderSource[],
    sourceReceipts: WarehouseReceiptSource[],
  ): void {
    const state = this.warehouseState();
    const stock = [...state.stock];
    const knownStock = new Set(stock.map((item) => item.sku));
    const stockIds = new Map<string, string>();
    const warnings: string[] = [];

    for (const item of inventory) {
      stockIds.set(item.id, item.sku);
      if (!Number.isSafeInteger(item.onHand) || item.onHand < 0) {
        warnings.push(`${item.sku}: inventory has an invalid on-hand quantity.`);
        continue;
      }
      if (!knownStock.has(item.sku)) {
        stock.push({
          sku: item.sku,
          product: item.name,
          onHand: item.onHand,
          allocated: 0,
          staged: 0,
          locations: {},
        });
        knownStock.add(item.sku);
      }
    }

    const orders = [...state.orders];
    const knownOrders = new Set(orders.map((order) => order.id));
    for (const source of sourceOrders) {
      if (
        knownOrders.has(source.id) ||
        !['CONFIRMED', 'PROCESSING', 'ACCEPTED'].includes(source.status) ||
        source.paymentStatus !== 'PAID'
      ) {
        continue;
      }

      const sourceLines = source.lines.map((line, index) => {
        const sku = stockIds.get(line.sku) ?? line.sku;
        const quantityIsValid = Number.isSafeInteger(line.quantity) && line.quantity > 0;
        if (!quantityIsValid) {
          warnings.push(`${source.orderNumber}: an item has an invalid requested quantity.`);
        }
        return {
          id: `${source.id}:${index}`,
          sku,
          product: line.product,
          requested: line.quantity,
          quantityIsValid,
        };
      });
      if (!sourceLines.length || sourceLines.some((line) => !line.quantityIsValid)) continue;

      const lines: WarehouseLine[] = sourceLines.map((line) => {
        const item = stock.find((stockItem) => stockItem.sku === line.sku);
        const allocated = item
          ? Math.min(line.requested, Math.max(0, item.onHand - item.allocated))
          : 0;
        if (item) {
          const index = stock.indexOf(item);
          stock[index] = { ...item, allocated: item.allocated + allocated };
        }
        return {
          id: line.id,
          sku: line.sku,
          product: line.product,
          requested: line.requested,
          allocated,
          picked: 0,
          packed: 0,
          dispatched: 0,
        };
      });
      orders.push({
        id: source.id,
        orderNumber: source.orderNumber,
        status: 'AWAITING_PICK',
        lines,
        packages: 0,
      });
      knownOrders.add(source.id);
    }

    const receipts = [...state.receipts];
    const knownReceipts = new Set(receipts.map((receipt) => receipt.id));
    for (const source of sourceReceipts) {
      if (knownReceipts.has(source.id) || source.status !== 'IN_TRANSIT') {
        continue;
      }
      source.lines.forEach((line, index) => {
        if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
          warnings.push(`${source.id}: an item has an invalid expected quantity.`);
          return;
        }
        const id = `${source.id}:${index}`;
        if (knownReceipts.has(id)) return;
        receipts.push({
          id,
          reference: source.id,
          sku: stockIds.get(line.sku) ?? line.sku,
          product: line.product,
          expected: line.quantity,
          status: 'PENDING',
        });
        knownReceipts.add(id);
      });
    }

    const allocated = this.allocatePendingOrders(stock, orders);
    this.warehouseState.set({
      ...state,
      stock: allocated.stock,
      orders: allocated.orders,
      receipts,
    });
    this.sourceWarnings.set(warnings);
    this.initialized.set(true);
  }

  receive(id: string, accepted: number, damaged: number, missing: number): void {
    const state = this.warehouseState();
    const receipt = state.receipts.find((row) => row.id === id);
    if (!receipt || receipt.status !== 'PENDING') {
      throw new Error('Receipt is no longer pending.');
    }
    this.nonNegative(accepted, 'Accepted');
    this.nonNegative(damaged, 'Damaged');
    this.nonNegative(missing, 'Missing');
    if (accepted + damaged + missing !== receipt.expected) {
      throw new Error(
        'Accepted, damaged, and missing quantities must equal the expected quantity.',
      );
    }

    const stock = [...state.stock];
    const index = stock.findIndex((item) => item.sku === receipt.sku);
    if (index < 0) {
      stock.push({
        sku: receipt.sku,
        product: receipt.product,
        onHand: accepted,
        allocated: 0,
        staged: 0,
        locations: {},
      });
    } else {
      const onHand = stock[index].onHand + accepted;
      if (!Number.isSafeInteger(onHand)) {
        throw new Error('Received quantity exceeds the supported inventory range.');
      }
      stock[index] = { ...stock[index], onHand };
    }

    let movements = state.movements;
    let nextMovementNumber = state.nextMovementNumber;
    if (accepted > 0) {
      const result = this.movement(
        nextMovementNumber,
        receipt.sku,
        accepted,
        'RECEIPT',
        receipt.reference,
        'Accepted stock received',
        'Warehouse staff',
      );
      movements = [result.movement, ...movements];
      nextMovementNumber = result.nextNumber;
    }

    const allocation = this.allocatePendingOrders(stock, state.orders);
    this.warehouseState.set({
      ...state,
      receipts: state.receipts.map((row) =>
        row.id === id ? { ...row, status: 'RECEIVED', accepted, damaged, missing } : row,
      ),
      stock: allocation.stock,
      orders: allocation.orders,
      movements,
      nextMovementNumber,
    });
  }

  putAway(sku: string, location: string, quantity: number, user: string): void {
    this.positive(quantity);
    const cleanLocation = location.trim();
    if (!cleanLocation) throw new Error('Storage location is required.');
    const cleanUser = this.requiredUser(user);
    const state = this.warehouseState();
    const index = state.stock.findIndex((item) => item.sku === sku);
    if (index < 0) throw new Error('Inventory item not found.');
    const item = state.stock[index];
    const assigned = Object.values(item.locations).reduce((sum, value) => sum + value, 0);
    if (item.onHand - assigned - item.staged < quantity) {
      throw new Error('Quantity exceeds unassigned stock.');
    }
    if (!Number.isSafeInteger((item.locations[cleanLocation] ?? 0) + quantity)) {
      throw new Error('Storage location quantity exceeds the supported range.');
    }

    const reference = `PUT-${state.nextMovementNumber}`;
    const result = this.movement(
      state.nextMovementNumber,
      sku,
      quantity,
      'PUT_AWAY',
      reference,
      `Put away to ${cleanLocation}`,
      cleanUser,
    );
    const stock = [...state.stock];
    stock[index] = {
      ...item,
      locations: {
        ...item.locations,
        [cleanLocation]: (item.locations[cleanLocation] ?? 0) + quantity,
      },
    };
    this.warehouseState.set({
      ...state,
      stock,
      movements: [result.movement, ...state.movements],
      nextMovementNumber: result.nextNumber,
    });
  }

  pick(orderId: string, lineId: string, quantity: number, user: string): void {
    this.positive(quantity);
    const cleanUser = this.requiredUser(user);
    const state = this.warehouseState();
    const orderIndex = state.orders.findIndex((row) => row.id === orderId);
    if (orderIndex < 0) throw new Error('Order not found.');
    const order = state.orders[orderIndex];
    if (!['AWAITING_PICK', 'PICKING'].includes(order.status)) {
      throw new Error('Order is not available for picking.');
    }
    const lineIndex = order.lines.findIndex((row) => row.id === lineId);
    if (lineIndex < 0) throw new Error('Order item not found.');
    const line = order.lines[lineIndex];
    if (line.picked + quantity > line.allocated) {
      throw new Error('Picked quantity exceeds allocated stock.');
    }
    const stockIndex = state.stock.findIndex((row) => row.sku === line.sku);
    if (stockIndex < 0 || state.stock[stockIndex].allocated < quantity) {
      throw new Error('Insufficient allocated stock.');
    }
    const stockItem = state.stock[stockIndex];
    if (stockItem.onHand - stockItem.staged < quantity) {
      throw new Error('Insufficient physical stock to pick.');
    }

    const lines = order.lines.map((row, index) =>
      index === lineIndex ? { ...row, picked: row.picked + quantity } : row,
    );
    const nextOrder = {
      ...order,
      lines,
      status: lines.every((row) => row.picked === row.requested)
        ? ('READY_TO_PACK' as const)
        : ('PICKING' as const),
    };
    const stock = [...state.stock];
    stock[stockIndex] = {
      ...stockItem,
      staged: stockItem.staged + quantity,
      locations: this.removeFromLocations(stockItem.locations, quantity),
    };
    const result = this.movement(
      state.nextMovementNumber,
      line.sku,
      -quantity,
      'PICK',
      orderId,
      `Picked for order ${order.orderNumber}`,
      cleanUser,
    );
    const orders = [...state.orders];
    orders[orderIndex] = nextOrder;
    this.warehouseState.set({
      ...state,
      orders,
      stock,
      movements: [result.movement, ...state.movements],
      nextMovementNumber: result.nextNumber,
    });
  }

  pack(orderId: string, packedQuantities: Record<string, number>, packages: number): void {
    this.positive(packages);
    const state = this.warehouseState();
    const orderIndex = state.orders.findIndex((row) => row.id === orderId);
    if (orderIndex < 0) throw new Error('Order not found.');
    const order = state.orders[orderIndex];
    if (
      order.status !== 'READY_TO_PACK' ||
      order.lines.some((line) => line.picked !== line.requested)
    ) {
      throw new Error('All requested items must be picked before packing.');
    }
    for (const line of order.lines) {
      const quantity = packedQuantities[line.id];
      this.nonNegative(quantity, 'Packed');
      if (quantity !== line.picked) {
        throw new Error('Packed quantities must match the picked quantities.');
      }
    }

    const orders = [...state.orders];
    orders[orderIndex] = {
      ...order,
      status: 'READY_TO_DISPATCH',
      packages,
      lines: order.lines.map((line) => ({ ...line, packed: packedQuantities[line.id] })),
    };
    this.warehouseState.set({ ...state, orders });
  }

  dispatchOrders(orderIds: string[], options: DispatchOptions): void {
    const { state, ids, selected, quantities, tripId, vehicleId, driverId, user } =
      this.prepareDispatch(orderIds, options);
    const stock = state.stock.map((item) => {
      const quantity = quantities.get(item.sku) ?? 0;
      return quantity
        ? {
            ...item,
            onHand: item.onHand - quantity,
            allocated: item.allocated - quantity,
            staged: item.staged - quantity,
          }
        : item;
    });
    const dispatchedAt = new Date().toISOString();
    const orders = state.orders.map((order) =>
      ids.includes(order.id)
        ? {
            ...order,
            status: 'DISPATCHED' as const,
            tripId,
            vehicleId,
            driverId,
            dispatchedAt,
            lines: order.lines.map((line) => ({ ...line, dispatched: line.packed })),
          }
        : order,
    );
    let movements = state.movements;
    let nextMovementNumber = state.nextMovementNumber;
    for (const [sku, quantity] of quantities) {
      if (!quantity) continue;
      const result = this.movement(
        nextMovementNumber,
        sku,
        -quantity,
        'DISPATCH',
        tripId,
        `Dispatched orders ${selected.map((order) => order.orderNumber).join(', ')}`,
        user,
      );
      movements = [result.movement, ...movements];
      nextMovementNumber = result.nextNumber;
    }

    this.warehouseState.set({
      ...state,
      stock,
      orders,
      movements,
      nextMovementNumber,
    });
  }

  validateDispatchOrders(orderIds: string[], options: DispatchOptions): void {
    this.prepareDispatch(orderIds, options);
  }

  private prepareDispatch(orderIds: string[], options: DispatchOptions): PreparedDispatch {
    const ids = [...new Set(orderIds)];
    if (!ids.length || ids.length !== orderIds.length) {
      throw new Error('Select one or more unique orders to dispatch.');
    }
    const tripId = options.tripId.trim();
    const vehicleId = options.vehicleId.trim();
    const driverId = options.driverId.trim();
    const user = this.requiredUser(options.user);
    if (!tripId || !vehicleId || !driverId) {
      throw new Error('An assigned delivery trip, vehicle, and driver are required.');
    }

    const state = this.warehouseState();
    const selected = ids.map((id) => {
      const order = state.orders.find((row) => row.id === id);
      if (!order || order.status !== 'READY_TO_DISPATCH') {
        throw new Error('Every selected order must be ready for dispatch.');
      }
      if (order.lines.some((line) => line.dispatched > 0 || line.packed !== line.picked)) {
        throw new Error('Order stock has already been dispatched or is not fully packed.');
      }
      return order;
    });
    const quantities = new Map<string, number>();
    for (const order of selected) {
      for (const line of order.lines) {
        const quantity = (quantities.get(line.sku) ?? 0) + line.packed;
        if (!Number.isSafeInteger(quantity)) {
          throw new Error(`Dispatch quantity exceeds the supported range for ${line.sku}.`);
        }
        quantities.set(line.sku, quantity);
      }
    }
    for (const [sku, quantity] of quantities) {
      const item = state.stock.find((row) => row.sku === sku);
      if (!item || item.onHand < quantity || item.allocated < quantity || item.staged < quantity) {
        throw new Error(`Insufficient allocated stock to dispatch ${sku}.`);
      }
    }

    return { state, ids, selected, quantities, tripId, vehicleId, driverId, user };
  }

  adjust(sku: string, quantity: number, reason: string, user: string): void {
    if (!Number.isSafeInteger(quantity) || quantity === 0) {
      throw new Error('Adjustment quantity must be a non-zero whole number.');
    }
    const cleanReason = reason.trim();
    const cleanUser = this.requiredUser(user);
    if (!cleanReason) throw new Error('Adjustment reason is required.');
    const state = this.warehouseState();
    const index = state.stock.findIndex((item) => item.sku === sku);
    if (index < 0) throw new Error('Inventory item not found.');
    const item = state.stock[index];
    const adjustedOnHand = item.onHand + quantity;
    if (!Number.isSafeInteger(adjustedOnHand)) {
      throw new Error('Adjustment exceeds the supported inventory range.');
    }
    if (adjustedOnHand < item.allocated || adjustedOnHand < item.staged) {
      throw new Error('Adjustment would reduce stock below allocated or picked quantities.');
    }
    const reference = `ADJ-${state.nextMovementNumber}`;
    const result = this.movement(
      state.nextMovementNumber,
      sku,
      quantity,
      'ADJUSTMENT',
      reference,
      cleanReason,
      cleanUser,
    );
    const stock = [...state.stock];
    stock[index] = {
      ...item,
      onHand: item.onHand + quantity,
      locations:
        quantity < 0 ? this.removeFromLocations(item.locations, -quantity) : item.locations,
    };
    const allocation = quantity > 0 ? this.allocatePendingOrders(stock, state.orders) : undefined;
    this.warehouseState.set({
      ...state,
      stock: allocation?.stock ?? stock,
      orders: allocation?.orders ?? state.orders,
      movements: [result.movement, ...state.movements],
      nextMovementNumber: result.nextNumber,
    });
  }

  private allocatePendingOrders(
    sourceStock: WarehouseStock[],
    sourceOrders: WarehouseOrder[],
  ): { stock: WarehouseStock[]; orders: WarehouseOrder[] } {
    const stock = [...sourceStock];
    const orders = sourceOrders.map((order) => ({
      ...order,
      lines: order.lines.map((line) => ({ ...line })),
    }));

    for (const order of orders) {
      if (!['AWAITING_PICK', 'PICKING'].includes(order.status)) continue;
      order.lines = order.lines.map((line) => {
        const index = stock.findIndex((item) => item.sku === line.sku);
        if (index < 0) return line;
        const item = stock[index];
        const needed = line.requested - line.allocated;
        const additional = Math.min(needed, Math.max(0, item.onHand - item.allocated));
        if (additional <= 0) return line;
        stock[index] = { ...item, allocated: item.allocated + additional };
        return { ...line, allocated: line.allocated + additional };
      });
    }

    return { stock, orders };
  }

  private positive(quantity: number): void {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive whole number.');
    }
  }

  private nonNegative(quantity: number, label: string): void {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new Error(`${label} quantity must be a non-negative whole number.`);
    }
  }

  private requiredUser(user: string): string {
    const cleanUser = user.trim();
    if (!cleanUser) throw new Error('The responsible user could not be identified.');
    return cleanUser;
  }

  private movement(
    number: number,
    sku: string,
    quantity: number,
    type: WarehouseMovement['type'],
    reference: string,
    reason: string,
    user: string,
  ): { movement: WarehouseMovement; nextNumber: number } {
    return {
      movement: {
        id: `MOV-${number}`,
        sku,
        quantity,
        type,
        reference,
        reason,
        user,
        at: new Date().toISOString(),
      },
      nextNumber: number + 1,
    };
  }

  private removeFromLocations(
    locations: Record<string, number>,
    quantity: number,
  ): Record<string, number> {
    const next = { ...locations };
    let remaining = quantity;
    for (const location of Object.keys(next)) {
      const removed = Math.min(remaining, next[location]);
      next[location] -= removed;
      remaining -= removed;
      if (next[location] === 0) delete next[location];
      if (remaining === 0) break;
    }
    return next;
  }
}
