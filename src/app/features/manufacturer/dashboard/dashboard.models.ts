export interface ManufacturerDashboard {
  activeDispatchFleet: number;
  activeDrivers: number;
  availableDrivers: number;
  activeShipments: number;
  delayedShipments: number;
  pendingPurchaseOrders: number;
  pendingPurchaseOrderValue: number;
  deliveriesToday: number;
  deliveriesOnTrackPercentage: number;
}
export interface DashboardPurchaseOrder {
  id: number;
  orderNumber: string;
  distributorName: string;
  itemSummary: string;
  totalAmount: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}
export interface DashboardShipment {
  id: number;
  shipmentNumber: string;
  destination: string;
  driverName: string;
  tripNumber: string;
  status: 'IN_TRANSIT' | 'DELAYED' | 'EXCEPTION' | 'DELIVERED';
  eta?: string;
}

export interface DashboardDriver {
  id: number;
  name: string;
  vehicle: string;
  status: 'ACTIVE' | 'STANDBY';
  route: string;
  latitude: number;
  longitude: number;
}

export interface DashboardAttentionItem {
  id: number;
  title: string;
  description: string;
  severity: 'WARNING' | 'CRITICAL';
  actionLabel: string;
  route: string;
}