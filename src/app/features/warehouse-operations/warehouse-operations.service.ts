import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Optional, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import {
  WarehouseInventorySource,
  WarehouseLine,
  WarehouseMovement,
  WarehouseOrder,
  WarehouseOrderSource,
  WarehouseReceipt,
  WarehouseReceiptLine,
  WarehouseStock,
} from './warehouse-operations.models';

interface WarehouseState {
  receipts: WarehouseReceipt[];
  orders: WarehouseOrder[];
  stock: WarehouseStock[];
  movements: WarehouseMovement[];
}

interface ApiPage<T> {
  content?: T[];
}

interface ApiShipment {
  id: string;
  purchaseOrderNumber: string;
  status: string;
  receiptLines: {
    purchaseOrderItemId: string;
    stockItemId: string;
    productName: string;
    expectedQuantity: number;
    acceptedQuantity?: number;
    damagedQuantity?: number;
    missingQuantity?: number;
  }[];
}

interface ApiStockLocation {
  stockItemId: string;
  sku: string;
  locationCode: string;
  quantity: number;
}

interface ApiStockMovement {
  id: string;
  stockItemId: string;
  movementType: 'RESTOCK_IN' | 'SALE_OUT' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE';
  quantityDelta: number;
  referenceType?: string;
  referenceId?: string;
  performedBy?: string;
  note?: string;
  createdAt: string;
}

interface ApiOrder {
  id: string;
  orderNumber: string;
  status: string;
  packageCount: number;
  items: {
    id: string;
    stockItemId: string;
    quantity: number;
    pickedQuantity: number;
    packedQuantity: number;
  }[];
}

export interface ReceiveShipmentPayload {
  note?: string;
  lines: {
    purchaseOrderItemId: string;
    acceptedQuantity: number;
    damagedQuantity: number;
    missingQuantity: number;
  }[];
}

@Injectable()
export class WarehouseOperationsService {
  private readonly locationRequests = new Set<string>();
  private readonly movementRequests = new Set<string>();
  private readonly warehouseState = signal<WarehouseState>({
    receipts: [],
    orders: [],
    stock: [],
    movements: [],
  });

  constructor(@Optional() private readonly http?: HttpClient) {}

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

  synchronize(
    inventory: WarehouseInventorySource[],
    sourceOrders: WarehouseOrderSource[],
    warehouseOwner: 'MANUFACTURER' | 'DISTRIBUTOR',
  ): void {
    const warnings: string[] = [];
    const stock: WarehouseStock[] = [];
    const existingStock = new Map(this.stock().map((item) => [item.id, item]));

    for (const source of inventory) {
      if (!source.id || !Number.isSafeInteger(source.onHand) || source.onHand < 0) {
        warnings.push(`${source.sku}: inventory has a missing stock-item ID or invalid quantity.`);
        continue;
      }
      const previous = existingStock.get(source.id);
      stock.push({
        id: source.id,
        sku: source.sku,
        product: source.name,
        onHand: source.onHand,
        allocated: 0,
        staged: previous?.staged ?? 0,
        locations: previous?.locations ?? {},
      });
    }

    const orders: WarehouseOrder[] = [];
    for (const source of sourceOrders) {
      if (source.paymentStatus !== 'PAID') continue;
      const status = this.orderStatus(source.status);
      if (!status) continue;

      const lines: WarehouseLine[] = source.lines.map((line, index) => {
        const quantityIsValid = Number.isSafeInteger(line.quantity) && line.quantity > 0;
        if (!quantityIsValid) warnings.push(`${source.orderNumber}: an item quantity is invalid.`);
        const canonicalItemId = line.orderItemId;
        const stockItemId =
          line.stockItemId ?? inventory.find((item) => item.sku === line.sku)?.id;
        return {
          id: canonicalItemId ?? `${source.id}:${index}`,
          orderItemId: canonicalItemId,
          stockItemId,
          sku: line.sku,
          product: line.product,
          requested: quantityIsValid ? line.quantity : 0,
          allocated: 0,
          picked: line.pickedQuantity ?? 0,
          packed: line.packedQuantity ?? 0,
          dispatched: 0,
        };
      });
      if (!lines.length || lines.some((line) => line.requested <= 0)) continue;
      orders.push({
        id: source.id,
        orderNumber: source.orderNumber,
        status,
        lines,
        packages: 0,
        fulfillmentSupported:
          warehouseOwner === 'DISTRIBUTOR' && lines.every((line) => !!line.orderItemId),
      });
    }

    this.allocatePendingOrders(stock, orders);
    this.warehouseState.update((state) => ({ ...state, stock, orders }));
    this.sourceWarnings.set(warnings);
    this.initialized.set(true);

    for (const item of stock) this.loadStockDetails(item.id, warehouseOwner);
  }

  loadShipments(): void {
    if (!this.http) return;
    this.http
      .get<ApiPage<ApiShipment> | ApiShipment[]>(API_ENDPOINTS.warehouseOperations.shipments)
      .subscribe({
        next: (response) => {
          const shipments = Array.isArray(response) ? response : (response.content ?? []);
          const receipts = shipments
            .filter((shipment) =>
              ['READY_FOR_DISPATCH', 'IN_TRANSIT', 'DELIVERED', 'RECEIVED'].includes(
                shipment.status,
              ),
            )
            .map((shipment) => this.toReceipt(shipment));
          this.warehouseState.update((state) => ({ ...state, receipts }));
        },
        error: () =>
          this.sourceWarnings.update((rows) => [
            ...rows,
            'Persisted inbound shipments could not be loaded from the warehouse API.',
          ]),
      });
  }

  refreshPersistedWarehouseData(warehouseOwner: 'MANUFACTURER' | 'DISTRIBUTOR'): void {
    this.locationRequests.clear();
    this.movementRequests.clear();
    if (warehouseOwner === 'DISTRIBUTOR') this.loadShipments();
    for (const item of this.stock()) this.loadStockDetails(item.id, warehouseOwner);
  }

  putAwayStock(
    stockItemId: string,
    location: string,
    quantity: number,
  ): Observable<ApiStockLocation> {
    this.requireHttp();
    this.positive(quantity);
    const locationCode = location.trim();
    if (!stockItemId) throw new Error('A canonical stock-item ID is required for put-away.');
    if (!locationCode) throw new Error('Storage location is required.');
    return this.http!
      .post<ApiStockLocation>(
        API_ENDPOINTS.warehouseOperations.stockItemLocations(stockItemId),
        { locationCode, quantity },
      )
      .pipe(
        tap((saved) => {
          this.warehouseState.update((state) => ({
            ...state,
            stock: state.stock.map((item) =>
              item.id === saved.stockItemId
                ? {
                    ...item,
                    locations: { ...item.locations, [saved.locationCode]: saved.quantity },
                  }
                : item,
            ),
          }));
        }),
      );
  }

  adjustStock(stockItemId: string, quantity: number, note: string): Observable<ApiStockMovement> {
    this.requireHttp();
    if (!stockItemId) throw new Error('A canonical stock-item ID is required for adjustment.');
    if (!Number.isSafeInteger(quantity) || quantity === 0) {
      throw new Error('Adjustment quantity must be a non-zero whole number.');
    }
    const cleanNote = note.trim();
    if (!cleanNote) throw new Error('Adjustment reason is required.');
    return this.http!
      .post<ApiStockMovement>(API_ENDPOINTS.warehouseOperations.stockItemMovements(stockItemId), {
        movementType: 'ADJUSTMENT',
        quantityDelta: quantity,
        note: cleanNote,
      })
      .pipe(tap((movement) => this.addPersistedMovement(movement)));
  }

  pickOrderItem(orderId: string, lineId: string, quantity: number): Observable<ApiOrder> {
    this.requireHttp();
    this.positive(quantity);
    const order = this.orders().find((row) => row.id === orderId);
    const line = order?.lines.find((row) => row.id === lineId);
    if (!order || !line) throw new Error('Order item not found.');
    if (!line.orderItemId) {
      throw new Error('Picking is unavailable: the source order has no canonical order-item ID.');
    }
    const pickedQuantity = line.picked + quantity;
    if (pickedQuantity > line.requested) {
      throw new Error('Picked quantity exceeds the order-item quantity.');
    }
    return this.http!
      .post<ApiOrder>(API_ENDPOINTS.warehouseOperations.orderPick(orderId), {
        orderItemId: line.orderItemId,
        pickedQuantity,
      })
      .pipe(tap((result) => this.applyOrderResponse(result)));
  }

  packOrder(orderId: string, packages: number): Observable<ApiOrder> {
    this.requireHttp();
    this.positive(packages);
    const order = this.orders().find((row) => row.id === orderId);
    if (!order) throw new Error('Order not found.');
    if (!order.fulfillmentSupported) {
      throw new Error('Packing is unavailable without canonical distributor order-item IDs.');
    }
    return this.http!
      .post<ApiOrder>(API_ENDPOINTS.warehouseOperations.orderPack(orderId), {
        packageCount: packages,
      })
      .pipe(tap((result) => this.applyOrderResponse(result)));
  }

  receiveShipment(shipmentId: string, payload: ReceiveShipmentPayload): Observable<ApiShipment> {
    this.requireHttp();
    if (!shipmentId) throw new Error('A canonical shipment ID is required for receipt.');
    if (!payload.lines.length || payload.lines.some((line) => !line.purchaseOrderItemId)) {
      throw new Error('Receipt is unavailable without canonical purchase-order item IDs.');
    }
    return this.http!
      .post<ApiShipment>(API_ENDPOINTS.warehouseOperations.receiveShipment(shipmentId), payload)
      .pipe(
        tap((shipment) => {
          const receipt = this.toReceipt(shipment);
          this.warehouseState.update((state) => ({
            ...state,
            receipts: [
              receipt,
              ...state.receipts.filter((item) => item.shipmentId !== shipment.id),
            ],
          }));
        }),
      );
  }

  validateDispatchOrders(orderIds: string[]): void {
    const selected = orderIds.map((id) => this.orders().find((order) => order.id === id));
    if (!orderIds.length || selected.some((order) => !order)) {
      throw new Error('Select one or more existing orders to dispatch.');
    }
    if (selected.some((order) => order!.status !== 'READY_TO_DISPATCH')) {
      throw new Error('Every selected order must be ready for dispatch.');
    }
  }

  private loadStockDetails(stockItemId: string, owner: 'MANUFACTURER' | 'DISTRIBUTOR'): void {
    if (!this.http) return;
    if (owner === 'DISTRIBUTOR' && !this.locationRequests.has(stockItemId)) {
      this.locationRequests.add(stockItemId);
      this.http
        .get<ApiStockLocation[]>(
          API_ENDPOINTS.warehouseOperations.stockItemLocations(stockItemId),
        )
        .subscribe({
          next: (locations) => {
            const mapped = Object.fromEntries(
              locations.map((location) => [location.locationCode, location.quantity]),
            );
            this.warehouseState.update((state) => ({
              ...state,
              stock: state.stock.map((item) =>
                item.id === stockItemId ? { ...item, locations: mapped } : item,
              ),
            }));
          },
          error: () =>
            this.sourceWarnings.update((rows) => [
              ...rows,
              `Persisted locations could not be loaded for stock item ${stockItemId}.`,
            ]),
        });
    }

    if (!this.movementRequests.has(stockItemId)) {
      this.movementRequests.add(stockItemId);
      this.http
        .get<ApiPage<ApiStockMovement> | ApiStockMovement[]>(
          `${API_ENDPOINTS.warehouseOperations.stockItemMovements(stockItemId)}?size=100`,
        )
        .subscribe({
          next: (response) => {
            const movements = Array.isArray(response) ? response : (response.content ?? []);
            const stock = this.stock().find((item) => item.id === stockItemId);
            if (!stock) return;
            const mapped = movements.map((movement) => this.toMovement(movement, stock.sku));
            const movementIds = new Set(mapped.map((movement) => movement.id));
            this.warehouseState.update((state) => ({
              ...state,
              movements: [
                ...mapped,
                ...state.movements.filter((movement) => !movementIds.has(movement.id)),
              ].sort((a, b) => b.at.localeCompare(a.at)),
            }));
          },
          error: () =>
            this.sourceWarnings.update((rows) => [
              ...rows,
              `Persisted movements could not be loaded for stock item ${stockItemId}.`,
            ]),
        });
    }
  }

  private addPersistedMovement(movement: ApiStockMovement): void {
    const stock = this.stock().find((item) => item.id === movement.stockItemId);
    if (!stock) return;
    const mapped = this.toMovement(movement, stock.sku);
    this.warehouseState.update((state) => ({
      ...state,
      movements: [mapped, ...state.movements.filter((item) => item.id !== mapped.id)],
    }));
  }

  private toMovement(movement: ApiStockMovement, sku: string): WarehouseMovement {
    return {
      id: movement.id,
      sku,
      quantity: movement.quantityDelta,
      type: movement.movementType,
      reference: [movement.referenceType, movement.referenceId].filter(Boolean).join(' · ') || '—',
      reason: movement.note ?? '',
      user: movement.performedBy ?? '—',
      at: movement.createdAt,
    };
  }

  private toReceipt(shipment: ApiShipment): WarehouseReceipt {
    const lines: WarehouseReceiptLine[] = shipment.receiptLines.map((line) => ({
      purchaseOrderItemId: line.purchaseOrderItemId,
      stockItemId: line.stockItemId,
      product: line.productName,
      expected: line.expectedQuantity,
      accepted: line.acceptedQuantity ?? line.expectedQuantity,
      damaged: line.damagedQuantity ?? 0,
      missing: line.missingQuantity ?? 0,
    }));
    const received = shipment.status === 'RECEIVED';
    return {
      id: shipment.id,
      shipmentId: shipment.id,
      shipmentStatus: shipment.status,
      reference: shipment.purchaseOrderNumber,
      sku: '',
      product: lines.map((line) => line.product).join(', '),
      expected: lines.reduce((sum, line) => sum + line.expected, 0),
      status: received ? 'RECEIVED' : 'PENDING',
      accepted: received ? lines.reduce((sum, line) => sum + line.accepted, 0) : undefined,
      damaged: received ? lines.reduce((sum, line) => sum + line.damaged, 0) : undefined,
      missing: received ? lines.reduce((sum, line) => sum + line.missing, 0) : undefined,
      lines,
    };
  }

  private applyOrderResponse(response: ApiOrder): void {
    const existing = this.orders().find((order) => order.id === response.id);
    if (!existing) return;
    const byItemId = new Map(existing.lines.map((line) => [line.orderItemId, line]));
    const lines = response.items.map((item, index) => {
      const previous = byItemId.get(item.id);
      return {
        id: item.id,
        orderItemId: item.id,
        stockItemId: item.stockItemId,
        sku: previous?.sku ?? item.stockItemId,
        product: previous?.product ?? item.stockItemId,
        requested: item.quantity,
        allocated: previous?.allocated ?? item.quantity,
        picked: item.pickedQuantity,
        packed: item.packedQuantity,
        dispatched: previous?.dispatched ?? 0,
      };
    });
    this.warehouseState.update((state) => ({
      ...state,
      orders: state.orders.map((order) =>
        order.id === response.id
          ? {
              ...order,
              orderNumber: response.orderNumber,
              status: this.orderStatus(response.status) ?? order.status,
              packages: response.packageCount,
              lines,
            }
          : order,
      ),
    }));
  }

  private orderStatus(status: string): WarehouseOrder['status'] | undefined {
    switch (status) {
      case 'CONFIRMED':
      case 'ACCEPTED':
        return 'AWAITING_PICK';
      case 'PROCESSING':
        return 'PICKING';
      case 'READY_TO_PACK':
        return 'READY_TO_PACK';
      case 'AWAITING_DISPATCH':
      case 'READY_TO_DISPATCH':
        return 'READY_TO_DISPATCH';
      case 'IN_TRANSIT':
      case 'DELIVERED':
      case 'COMPLETED':
        return 'DISPATCHED';
      default:
        return undefined;
    }
  }

  private allocatePendingOrders(stock: WarehouseStock[], orders: WarehouseOrder[]): void {
    for (const order of orders) {
      if (!['AWAITING_PICK', 'PICKING'].includes(order.status)) continue;
      for (const line of order.lines) {
        const item = stock.find(
          (row) => row.id === line.stockItemId || row.sku === line.sku,
        );
        if (!item) continue;
        const additional = Math.min(
          line.requested - line.picked,
          Math.max(0, item.onHand - item.allocated),
        );
        line.allocated = line.picked + additional;
        item.allocated += additional;
      }
    }
  }

  private requireHttp(): void {
    if (!this.http) throw new Error('Warehouse APIs are not available in this context.');
  }

  private positive(quantity: number): void {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive whole number.');
    }
  }
}
