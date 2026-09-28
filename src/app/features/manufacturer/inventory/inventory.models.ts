export interface InventoryTerminal {
  id: string;
  name: string;
  city: string;
}

export interface TerminalInventoryRecord {
  productName: string;
  sku: string;
  category: string;
  terminalId: string;
  totalStock: number;
  reservedHolds: number;
}

export type InventoryAlert = 'HEALTHY LEVEL' | 'CRITICAL STOCK HOLD';

export interface InventoryRow extends TerminalInventoryRecord {
  availableNet: number;
  alert: InventoryAlert;
}
