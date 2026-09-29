import { computed, Injectable, signal } from '@angular/core';
import { DistributorInventoryItem, StockDeduction, StockLevel } from './inventory.models';

const initialInventory: DistributorInventoryItem[] = [
  { sku: 'HDM-092-X', name: 'Heavy Duty Hydraulic Motor', category: 'Motors', unit: 'Pcs', onHand: 14, unitPrice: 750, lowStockThreshold: 60, criticalStockThreshold: 20 },
  { sku: 'HPG-881-A', name: 'High-Precision Gear Box', category: 'Transmission', unit: 'Pcs', onHand: 42, unitPrice: 650, lowStockThreshold: 50, criticalStockThreshold: 15 },
  { sku: 'PCV-404-Z', name: 'Pneumatic Control Valve', category: 'Valves', unit: 'Pcs', onHand: 320, unitPrice: 500, lowStockThreshold: 80, criticalStockThreshold: 30 },
  { sku: 'VRB-332-Y', name: 'Voltage Regulator Block', category: 'Electronics', unit: 'Pcs', onHand: 1240, unitPrice: 600, lowStockThreshold: 200, criticalStockThreshold: 80 },
  { sku: 'GA-210-C', name: 'Gear Assembly Unit', category: 'Transmission', unit: 'Pcs', onHand: 860, unitPrice: 182, lowStockThreshold: 150, criticalStockThreshold: 60 },
  { sku: 'CSM-118-B', name: 'Compact Servo Motor', category: 'Motors', unit: 'Pcs', onHand: 96, unitPrice: 850, lowStockThreshold: 40, criticalStockThreshold: 15 }
];

@Injectable({ providedIn: 'root' })
export class DistributorInventoryService {
  private readonly inventoryRecords = signal(initialInventory);

  readonly items = this.inventoryRecords.asReadonly();
  readonly thresholdAlerts = computed(() => this.inventoryRecords()
    .filter(item => this.stockLevel(item) !== 'HEALTHY')
    .sort((first, second) => first.onHand / first.lowStockThreshold - second.onHand / second.lowStockThreshold));

  findBySku(sku: string): DistributorInventoryItem | undefined {
    return this.inventoryRecords().find(item => item.sku === sku);
  }

  stockLevel(item: DistributorInventoryItem): StockLevel {
    if (item.onHand <= item.criticalStockThreshold) return 'CRITICAL';
    if (item.onHand <= item.lowStockThreshold) return 'LOW';
    return 'HEALTHY';
  }

  deduct(deductions: StockDeduction[]): void {
    for (const deduction of deductions) {
      const item = this.findBySku(deduction.sku);
      if (!item || item.onHand < deduction.quantity) {
        throw new Error(`Not enough stock for ${item?.name ?? deduction.sku}.`);
      }
    }
    this.inventoryRecords.update(items => items.map(item => {
      const quantity = deductions
        .filter(deduction => deduction.sku === item.sku)
        .reduce((sum, deduction) => sum + deduction.quantity, 0);
      return quantity ? { ...item, onHand: item.onHand - quantity } : item;
    }));
  }
}
