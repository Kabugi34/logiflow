import { PaymentStatus } from '../../../core/models/payment.model';

export type PurchaseOrderStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'FULFILLED';
export type PurchasePaymentStatus = PaymentStatus;

export interface PurchaseOrderLine {
  productName: string;
  sku: string;
  requestedQuantity: number;
  availableStock: number;
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
