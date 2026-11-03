export type PaymentStatus =
  'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'REVERSED' | 'REFUNDED' | 'UNKNOWN';

export type PaymentOrderType = 'PURCHASE_ORDER' | 'CUSTOMER_ORDER';
export type PaymentDirection = 'INCOMING' | 'OUTGOING';
export type PaymentTransactionStatus =
  'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'REVERSED' | 'REFUNDED' | 'UNKNOWN';

export interface PaymentTransaction {
  id: string;
  paymentReference: string;
  orderId: string;
  orderReference: string;
  orderType: PaymentOrderType;
  direction: PaymentDirection;
  counterpartyName: string;
  amount: number;
  currency: string;
  provider: string;
  status: PaymentTransactionStatus;
  createdAt: string;
  updatedAt: string;
  reconciledAt: string | null;
  reconciliationStatus: string;
  reconciliationReference: string | null;
  mpesaReceiptNumber: string | null;
  failureReason: string | null;
}

export interface PaymentInitiationRequest {
  orderId: string;
  orderType: PaymentOrderType;
  provider: 'MPESA';
  phoneNumber: string;
}

export interface PaymentInitiationResult {
  paymentId: string;
  paymentReference: string | null;
  provider: string;
  customerMessage: string | null;
}

export interface PaymentVerification {
  paymentExists: boolean;
  status: PaymentStatus;
  transaction?: PaymentTransaction;
  failureReason?: string | null;
  mpesaReceiptNumber?: string | null;
}

export function normalizePaymentTransactionStatus(
  status: string | null | undefined,
): PaymentTransactionStatus {
  switch (status?.trim().toUpperCase()) {
    case 'PAID':
    case 'SUCCEEDED':
    case 'SUCCESS':
    case 'CONFIRMED':
    case 'RECONCILED':
      return 'SUCCEEDED';
    case 'PENDING':
    case 'INITIATED':
    case 'PROCESSING':
      return 'PENDING';
    case 'FAILED':
      return 'FAILED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'REVERSED':
      return 'REVERSED';
    case 'REFUNDED':
      return 'REFUNDED';
    default:
      return 'UNKNOWN';
  }
}

export function normalizePaymentStatus(status: string | null | undefined): PaymentStatus {
  switch (status?.trim().toUpperCase()) {
    case 'PAID':
    case 'SUCCEEDED':
    case 'SUCCESS':
    case 'CONFIRMED':
    case 'RECONCILED':
      return 'PAID';
    case 'PENDING':
    case 'INITIATED':
    case 'PROCESSING':
      return 'PENDING';
    case 'FAILED':
      return 'FAILED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'REVERSED':
      return 'REVERSED';
    case 'REFUNDED':
      return 'REFUNDED';
    default:
      return 'UNKNOWN';
  }
}
