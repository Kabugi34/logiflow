import { Injectable } from '@angular/core';
import { ManufacturerReportSnapshot, ReportWarehouse } from './report.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerReportService {
  // Reporting aggregation endpoints are not available in the backend API yet.
  readonly warehouses: ReportWarehouse[] = [];
  getSnapshot(_warehouseId: string): ManufacturerReportSnapshot {
    return { inventoryAccuracyPercent: 0, purchaseOrderLeadTimeDays: 0, slaOnTimePercent: 0,
      driverWorkUtilizationPercent: 0, weeklyShipmentVolume: [], warehouseDistribution: [] };
  }
  getMaximumWeeklyLoads(warehouseId: string): number {
    return Math.max(...this.getSnapshot(warehouseId).weeklyShipmentVolume.map(week => week.loads), 1);
  }
}
