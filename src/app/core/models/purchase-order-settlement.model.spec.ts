import {
  hasAwaitingBankPayment,
  isPartiallyPaid,
  MAX_PROOF_BYTES,
  proofFileError,
  PurchaseOrderSettlement,
} from './purchase-order-settlement.model';

function settlement(overrides: Partial<PurchaseOrderSettlement> = {}): PurchaseOrderSettlement {
  return {
    id: 's1',
    status: 'PENDING',
    amount: 1000,
    currency: 'KES',
    note: null,
    settledAt: null,
    method: 'BANK_TRANSFER',
    totalDue: 1000,
    amountPaid: 0,
    amountOutstanding: 1000,
    payments: [],
    ...overrides,
  };
}

describe('purchase order settlement helpers', () => {
  it('derives partial payment from amounts, not from a status', () => {
    expect(isPartiallyPaid(settlement({ amountPaid: 0 }))).toBe(false);
    expect(isPartiallyPaid(settlement({ amountPaid: 400 }))).toBe(true);
    expect(isPartiallyPaid(settlement({ amountPaid: 1000 }))).toBe(false);
  });

  it('flags a submitted bank slip as awaiting confirmation until it is confirmed', () => {
    const slip = {
      id: 'p1',
      method: 'BANK_TRANSFER' as const,
      payerReference: 'REF',
      amount: null,
      status: 'SUBMITTED' as const,
      proofDocumentId: 'd1',
      submittedAt: '2026-11-24T10:00:00Z',
      confirmedAt: null,
    };
    expect(hasAwaitingBankPayment([settlement({ payments: [slip] })])).toBe(true);
    expect(
      hasAwaitingBankPayment([
        settlement({ payments: [{ ...slip, status: 'CONFIRMED', amount: 1000 }] }),
      ]),
    ).toBe(false);
    expect(hasAwaitingBankPayment([settlement()])).toBe(false);
  });

  it('pre-checks proof files without replacing server validation', () => {
    expect(proofFileError(null)).not.toBe('');
    expect(proofFileError({ size: 0, type: 'application/pdf' })).toMatch(/empty/i);
    expect(proofFileError({ size: MAX_PROOF_BYTES + 1, type: 'application/pdf' })).toMatch(/5 MB/);
    expect(proofFileError({ size: 10, type: 'text/html' })).toMatch(/PDF, JPG or PNG/);
    expect(proofFileError({ size: 10, type: 'image/png' })).toBe('');
  });
});