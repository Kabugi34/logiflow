export type InboundLogisticsStatus = 'PENDING' | 'PROCESSING' | 'REJECTED' | 'IN_TRANSIT' | 'DELIVERED';

export interface LogisticsRoutePoint {
  latitude: number;
  longitude: number;
  label: string;
}

export interface LogisticsTimelineEvent {
  title: string;
  detail: string;
  state: 'COMPLETE' | 'CURRENT' | 'UPCOMING';
}

export interface InboundLogisticsLine {
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface InboundLogisticsOrder {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  manufacturerLocation: string;
  distributorName: string;
  orderDate: string;
  expectedDelivery: string;
  status: InboundLogisticsStatus;
  destination: string;
  logisticsCost: number;
  lines: InboundLogisticsLine[];
  timeline: LogisticsTimelineEvent[];
  shipmentId?: string;
  tripId?: string;
  driverName?: string;
  vehicleLabel?: string;
  route: LogisticsRoutePoint[];
  currentRouteIndex: number;
}