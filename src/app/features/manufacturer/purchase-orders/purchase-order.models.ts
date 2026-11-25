import { PaymentStatus } from '../../../core/models/payment.model';
import {
  PurchaseOrderSettlement,
  PurchasePaymentTerms,
} from '../../../core/models/purchase-order-settlement.model';

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
  distributorId: string;
  distributorName: string;
  paymentTerms: PurchasePaymentTerms;
  /** Order total from the API; the line total can differ when the API adds no extra charges. */
  totalAmount: number;
  amountPaid: number;
  amountOutstanding: number;
  dueAt: string | null;
  overdue: boolean;
  settlements: PurchaseOrderSettlement[];
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
