export type WarehouseOrderStatus =
  'AWAITING_PICK' | 'PICKING' | 'READY_TO_PACK' | 'READY_TO_DISPATCH' | 'DISPATCHED';

export interface WarehouseLine {
  id: string;
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
}

export interface WarehouseReceipt {
  id: string;
  reference: string;
  sku: string;
  product: string;
  expected: number;
  status: 'PENDING' | 'RECEIVED';
  accepted?: number;
  damaged?: number;
  missing?: number;
}

export interface WarehouseStock {
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
  type: 'RECEIPT' | 'PUT_AWAY' | 'PICK' | 'DISPATCH' | 'ADJUSTMENT';
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
  lines: { sku: string; product: string; quantity: number }[];
}

export interface WarehouseReceiptSource {
  id: string;
  status: string;
  lines: { sku: string; product: string; quantity: number }[];
}
