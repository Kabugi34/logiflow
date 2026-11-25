export type SettlementMethod = 'MPESA' | 'BANK_TRANSFER';
export type SettlementPaymentState = 'SUBMITTED' | 'CONFIRMED';
export type PurchasePaymentTerms = 'PAY_NOW' | 'CREDIT';

/** One payment toward a settlement. A SUBMITTED bank slip has no amount until the supplier confirms. */
export interface SettlementPayment {
  id: string;
  method: SettlementMethod;
  payerReference: string;
  amount: number | null;
  status: SettlementPaymentState;
  proofDocumentId: string | null;
  submittedAt: string;
  confirmedAt: string | null;
}

export interface PurchaseOrderSettlement {
  id: string;
  /** Settlement status is unchanged by Phase 2: PENDING, SETTLED, FAILED, REVERSED. */
  status: string;
  amount: number;
  currency: string;
  providerReference?: string | null;
  note: string | null;
  settledAt: string | null;
  createdAt?: string;
  method: SettlementMethod;
  totalDue: number;
  amountPaid: number;
  amountOutstanding: number;
  payments: SettlementPayment[];
}

/** Money received is derived: there is no PARTIALLY_PAID status. */
export function isPartiallyPaid(settlement: Pick<PurchaseOrderSettlement, 'amountPaid' | 'totalDue'>): boolean {
  return settlement.amountPaid > 0 && settlement.amountPaid < settlement.totalDue;
}

export function hasAwaitingBankPayment(settlements: readonly PurchaseOrderSettlement[]): boolean {
  return settlements.some((settlement) =>
    settlement.payments.some(
      (payment) => payment.method === 'BANK_TRANSFER' && payment.status === 'SUBMITTED',
    ),
  );
}

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const PROOF_ACCEPT = 'application/pdf,image/jpeg,image/png';
const PROOF_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

/** Client-side pre-check only; the server validates content type, magic bytes and size again. */
export function proofFileError(file: { size: number; type: string } | null | undefined): string {
  if (!file) return 'Choose the bank slip or transfer confirmation to upload.';
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > MAX_PROOF_BYTES) return 'The proof must not exceed 5 MB.';
  if (!PROOF_TYPES.has(file.type)) return 'The proof must be a PDF, JPG or PNG file.';
  return '';
}

export interface DistributorCredit {
  distributorOrganizationId: string;
  distributorName: string;
  currency: string;
  hasRelationshipTerms: boolean;
  creditLimit: number | null;
  termDays: number | null;
  status: 'ACTIVE' | 'SUSPENDED' | null;
  version: number | null;
  effectiveSource: 'RELATIONSHIP' | 'PLATFORM_DEFAULT' | 'NONE';
  effectiveLimit: number | null;
  effectiveTermDays: number | null;
  outstanding: number;
  available: number;
  overdueOrders: number;
}

export interface CreditStatementLine {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  outstanding: number;
  createdAt: string;
  dueAt: string | null;
  overdue: boolean;
  payments: SettlementPayment[];
}

export interface CreditStatement {
  credit: DistributorCredit;
  orders: CreditStatementLine[];
}

export interface CreditTermsUpdate {
  creditLimit: number;
  termDays: number;
  status: 'ACTIVE' | 'SUSPENDED';
  expectedVersion?: number | null;
}
