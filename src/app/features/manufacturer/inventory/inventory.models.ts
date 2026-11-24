export interface InventoryTerminal {
  id: string;
  name: string;
  city: string;
}

export interface TerminalInventoryRecord {
  id: string;
  productName: string;
  sku: string;
  category: string;
  terminalId: string;
  totalStock: number;
  reservedHolds: number;
  availableQuantity: number;
  stockItemId: string;
  warehouseId?: string | null;
  warehouseName?: string;
}

export type InventoryAlert = 'HEALTHY LEVEL' | 'CRITICAL STOCK HOLD';

export interface InventoryRow extends TerminalInventoryRecord {
  availableNet: number;
  alert: InventoryAlert;
}

export interface StockIntakeResult {
  movementId: string;
  stockItemId: string;
  warehouseId: string;
  quantityReceived: number;
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  sourceReference: string;
  status: string;
}

export interface StockMovementRecord {
  id: string;
  movementType: string;
  quantity?: number;
  quantityDelta?: number;
  sourceReference?: string | null;
  reference?: string | null;
  status?: string;
  createdAt?: string;
  note?: string | null;
}
