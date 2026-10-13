import { Injectable } from '@angular/core';
import { ManufacturerReportSnapshot, ReportWarehouse } from './report.models';

const warehouses: ReportWarehouse[] = [
  { id: 'NBO-A1', name: 'Nairobi Central Hub', occupancyPercent: 82 },
  { id: 'NAK-W2', name: 'Nakuru Regional Terminal', occupancyPercent: 45 },
  { id: 'MBA-C4', name: 'Mombasa Freight Depot', occupancyPercent: 91 }
];

const reportSnapshots: Record<string, ManufacturerReportSnapshot> = {
  ALL: {
    inventoryAccuracyPercent: 99.82,
    purchaseOrderLeadTimeDays: 1.4,
    slaOnTimePercent: 98.15,
    driverWorkUtilizationPercent: 84.3,
    weeklyShipmentVolume: [{ label: 'W1', loads: 180 }, { label: 'W2', loads: 220 }, { label: 'W3', loads: 195 }, { label: 'W4', loads: 145 }],
    warehouseDistribution: warehouses
  },
  'NBO-A1': {
    inventoryAccuracyPercent: 99.91,
    purchaseOrderLeadTimeDays: 1.2,
    slaOnTimePercent: 98.8,
    driverWorkUtilizationPercent: 82.1,
    weeklyShipmentVolume: [{ label: 'W1', loads: 72 }, { label: 'W2', loads: 94 }, { label: 'W3', loads: 88 }, { label: 'W4', loads: 61 }],
    warehouseDistribution: [warehouses[0]]
  },
  'NAK-W2': {
    inventoryAccuracyPercent: 99.74,
    purchaseOrderLeadTimeDays: 1.6,
    slaOnTimePercent: 97.4,
    driverWorkUtilizationPercent: 86.8,
    weeklyShipmentVolume: [{ label: 'W1', loads: 38 }, { label: 'W2', loads: 46 }, { label: 'W3', loads: 42 }, { label: 'W4', loads: 35 }],
    warehouseDistribution: [warehouses[1]]
  },
  'MBA-C4': {
    inventoryAccuracyPercent: 99.79,
    purchaseOrderLeadTimeDays: 1.5,
    slaOnTimePercent: 98.05,
    driverWorkUtilizationPercent: 85.4,
    weeklyShipmentVolume: [{ label: 'W1', loads: 70 }, { label: 'W2', loads: 80 }, { label: 'W3', loads: 65 }, { label: 'W4', loads: 49 }],
    warehouseDistribution: [warehouses[2]]
  }
};

@Injectable({ providedIn: 'root' })
export class ManufacturerReportService {
  readonly warehouses = warehouses;

  getSnapshot(warehouseId: string): ManufacturerReportSnapshot {
    return reportSnapshots[warehouseId] ?? reportSnapshots['ALL'];
  }

  getMaximumWeeklyLoads(warehouseId: string): number {
    return Math.max(...this.getSnapshot(warehouseId).weeklyShipmentVolume.map(week => week.loads), 1);
  }
}
