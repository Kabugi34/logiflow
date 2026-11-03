import { normalizePaymentStatus } from './payment.model';

describe('normalizePaymentStatus', () => {
  it('maps successful backend payment states to paid', () => {
    for (const status of ['PAID', 'SUCCEEDED', 'SUCCESS', 'CONFIRMED', 'RECONCILED']) {
      expect(normalizePaymentStatus(status)).toBe('PAID');
    }
  });

  it('preserves non-success payment states instead of treating them as pending', () => {
    expect(normalizePaymentStatus('PENDING')).toBe('PENDING');
    expect(normalizePaymentStatus('FAILED')).toBe('FAILED');
    expect(normalizePaymentStatus('EXPIRED')).toBe('EXPIRED');
    expect(normalizePaymentStatus('REVERSED')).toBe('REVERSED');
    expect(normalizePaymentStatus('REFUNDED')).toBe('REFUNDED');
  });

  it('keeps absent or unrecognized payment status unknown', () => {
    expect(normalizePaymentStatus(undefined)).toBe('UNKNOWN');
    expect(normalizePaymentStatus('not-a-status')).toBe('UNKNOWN');
  });
});
