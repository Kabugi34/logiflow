import { PaymentStatus } from '../../../core/models/payment.model';
import {
  PurchaseOrderSettlement,
  PurchasePaymentTerms,
} from '../../../core/models/purchase-order-settlement.model';

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
  issueDate: string;
  status: PurchaseOrderStatus;
  paymentStatus: PurchasePaymentStatus;
  lines: PurchaseOrderLine[];
  timeline: PurchaseOrderTimelineEvent[];
}
