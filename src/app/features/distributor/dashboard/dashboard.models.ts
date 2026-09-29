import { StockLevel } from '../inventory/inventory.models';
import { CustomerOrderStatus } from '../orders/order.models';

export interface DistributorDashboard {
  customerOrdersToday: number;
  pendingOrders: number;
  shippedOrders: number;
  paidOrders: number;
  inventoryValue: number;
  inventoryUnits: number;
  inventoryCategories: number;
  incomingPurchaseOrders: number;
  incomingPurchaseOrderValue: number;
  supplyingManufacturers: number;
  activeDeliveryTrips: number;
  standbyDrivers: number;
  completedTrips: number;
}

export interface DashboardCustomerOrder {
  id: string;
  customerName: string;
  itemSummary: string;
  total: number;
  status: CustomerOrderStatus;
}

export interface DashboardStockAlert {
  sku: string;
  name: string;
  onHand: number;
  unit: string;
  level: Exclude<StockLevel, 'HEALTHY'>;
}

export interface DashboardVehicle {
  id: string;
  model: string;
  status: 'AVAILABLE' | 'ON_TRIP';
  locationLabel: string;
  latitude: number;
  longitude: number;
}

export interface DashboardFleetDriver {
  id: string;
  name: string;
  status: 'STANDBY' | 'ON_TRIP';
  vehicleModel?: string;
  orderId?: string;
  locationLabel: string;
}
