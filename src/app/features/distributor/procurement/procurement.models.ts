import { LogisticsRoutePoint } from '../../../core/logistics/logistics.models';

export type ProcurementStatus = 'IN_TRANSIT' | 'PROCESSING' | 'PENDING' | 'DELIVERED' | 'REJECTED';

export interface ProcurementManufacturer {
  id: string;
  name: string;
  productBrand: string;
  location: string;
}

export interface ProcurementOrderLine {
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface ProcurementTimelineEvent {
  title: string;
  detail: string;
  state: 'COMPLETE' | 'CURRENT' | 'UPCOMING';
}

export interface DistributorPurchaseOrder {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  manufacturerLocation: string;
  orderDate: string;
  expectedDelivery: string;
  status: ProcurementStatus;
  destination: string;
  logisticsCost: number;
  lines: ProcurementOrderLine[];
  timeline: ProcurementTimelineEvent[];
  shipmentId?: string;
  tripId?: string;
  driverName?: string;
  vehicleLabel?: string;
  route: LogisticsRoutePoint[];
  currentRouteIndex: number;
}

export interface DraftProcurementLine {
  sku: string;
  quantity: number;
}
