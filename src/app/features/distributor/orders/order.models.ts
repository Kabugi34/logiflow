export type CustomerOrderStatus =
  | 'PREPARING'
  | 'IN_TRANSIT'
  | 'REROUTED'
  | 'COMPLETED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'AWAITING_DISPATCH'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'FAILED';
export type PaymentStatus = 'PAID' | 'PENDING' | 'UNKNOWN';
export type DeliveryStatus = 'UNASSIGNED' | 'ON_ROUTE' | 'HOLD' | 'DELIVERED' | 'UNKNOWN';
export type OrderBadgeValue = CustomerOrderStatus | PaymentStatus | DeliveryStatus;

export interface CustomerOrderLine {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
}

export interface OrderLogEvent {
  title: string;
  detail: string;
  state: 'COMPLETE' | 'CURRENT';
}

export interface CustomerOrder {
  orderNumber?: string;
  id: string;
  customerId: string;
  customerName: string;
  destinationName: string;
  destinationAddress: string;
  orderDate: string;
  paymentStatus: PaymentStatus;
  status: CustomerOrderStatus;
  deliveryStatus: DeliveryStatus;
  vehicleId?: string;
  driverId?: string;
  lines: CustomerOrderLine[];
  log: OrderLogEvent[];
}

export interface NewCustomerOrder {
  customerId: string;
  paymentStatus: PaymentStatus;
  lines: { sku: string; quantity: number }[];
}

export interface DistributorShipmentGroup {
  id: string;
  routeKey: string;
  routeLabel: string;
  status: CustomerOrderStatus;
  orderIds: string[];
  orders: CustomerOrder[];
  driverId?: string;
  vehicleId?: string;
  totalValue: number;
  route: { latitude: number; longitude: number; label: string }[];
  currentRouteIndex: number;
}
