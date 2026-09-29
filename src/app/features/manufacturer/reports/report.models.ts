export interface ReportWarehouse {
  id: string;
  name: string;
  occupancyPercent: number;
}

export interface WeeklyShipmentVolume {
  label: string;
  loads: number;
}

export interface ManufacturerReportSnapshot {
  inventoryAccuracyPercent: number;
  purchaseOrderLeadTimeDays: number;
  slaOnTimePercent: number;
  driverWorkUtilizationPercent: number;
  weeklyShipmentVolume: WeeklyShipmentVolume[];
  warehouseDistribution: ReportWarehouse[];
}
