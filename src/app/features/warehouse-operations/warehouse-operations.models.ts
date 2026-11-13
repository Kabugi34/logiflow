export type WarehouseOrderStatus =
  'AWAITING_PICK' | 'PICKING' | 'READY_TO_PACK' | 'READY_TO_DISPATCH' | 'DISPATCHED';

export interface WarehouseLine {
  id: string;
  orderItemId?: string;
  stockItemId?: string;
  sku: string;
  product: string;
  requested: number;
  allocated: number;
  picked: number;
  packed: number;
  dispatched: number;
}

export interface WarehouseOrder {
  id: string;
  orderNumber: string;
  status: WarehouseOrderStatus;
  lines: WarehouseLine[];
  packages: number;
  tripId?: string;
  vehicleId?: string;
  driverId?: string;
  dispatchedAt?: string;
  fulfillmentSupported?: boolean;
}

export interface WarehouseReceiptLine {
  purchaseOrderItemId: string;
  stockItemId: string;
  product: string;
  expected: number;
  accepted: number;
  damaged: number;
  missing: number;
}

export interface WarehouseReceipt {
  id: string;
  shipmentId: string;
  shipmentStatus: string;
  reference: string;
  sku: string;
  product: string;
  expected: number;
  status: 'PENDING' | 'RECEIVED';
  accepted?: number;
  damaged?: number;
  missing?: number;
  lines: WarehouseReceiptLine[];
}

export interface WarehouseStock {
  id: string;
  sku: string;
  product: string;
  onHand: number;
  allocated: number;
  staged: number;
  locations: Record<string, number>;
}

export interface WarehouseMovement {
  id: string;
  sku: string;
  quantity: number;
  type: 'RESTOCK_IN' | 'SALE_OUT' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE';
  reference: string;
  reason: string;
  user: string;
  at: string;
}

export interface WarehouseInventorySource {
  id: string;
  sku: string;
  name: string;
  onHand: number;
}

export interface WarehouseOrderSource {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  lines: {
    orderItemId?: string;
    stockItemId?: string;
    sku: string;
    product: string;
    quantity: number;
    pickedQuantity?: number;
    packedQuantity?: number;
  }[];
}
