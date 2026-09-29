export type StockLevel = 'HEALTHY' | 'LOW' | 'CRITICAL';

export interface DistributorInventoryItem {
  sku: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  unitPrice: number;
  lowStockThreshold: number;
  criticalStockThreshold: number;
}

export interface StockDeduction {
  sku: string;
  quantity: number;
}
