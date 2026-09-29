export type CustomerOrderStatus = 'PREPARING' | 'IN_TRANSIT' | 'REROUTED' | 'COMPLETED';
export type PaymentStatus = 'PAID' | 'PENDING';
export type DeliveryStatus = 'UNASSIGNED' | 'ON_ROUTE' | 'HOLD' | 'DELIVERED';
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
