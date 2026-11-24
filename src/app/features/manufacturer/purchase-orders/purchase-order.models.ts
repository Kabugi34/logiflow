import { PaymentStatus } from '../../../core/models/payment.model';

export type PurchaseOrderStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'FULFILLED' | 'UNKNOWN';
export type PurchasePaymentStatus = PaymentStatus;
export type PurchaseFulfilmentStatus = 'INVENTORY_EXCEPTION' | 'READY_FOR_PICKING' | 'PICKING' | 'READY_FOR_DISPATCH' | 'UNKNOWN';

export interface PurchaseOrderLine {
  productName: string;
  sku: string;
  requestedQuantity: number;
  availableStock: number;
  purchaseOrderItemId?: string;
  stockItemId?: string;
  pickedQuantity: number;
  packedQuantity: number;
  unitPrice: number;
  unit: string;
}

export interface PurchaseOrderTimelineEvent {
  title: string;
  detail: string;
  occurredAt: string;
  state: 'COMPLETE' | 'CURRENT' | 'UPCOMING';
}

export interface ManufacturerPurchaseOrder {
  id: string;
  distributorName: string;
  manufacturerName: string;
  destinationHub: string;
  destinationWarehouseId?: string;
  issueDate: string;
  status: PurchaseOrderStatus;
  purchaseOrderNumber?: string;
  fulfilmentStatus: PurchaseFulfilmentStatus;
  packageCount?: number;
  paymentStatus: PurchasePaymentStatus;
  paymentDetails?: {
    amount: number;
    currency: string;
    reference: string;
    mode: string;
    reconciledAt?: string | null;
  };
  lines: PurchaseOrderLine[];
  timeline: PurchaseOrderTimelineEvent[];
}
