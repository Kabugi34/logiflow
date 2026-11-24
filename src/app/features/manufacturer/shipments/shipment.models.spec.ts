import { normalizeShipmentStatus } from './shipment.models';

describe('normalizeShipmentStatus', () => {
  it('recognizes supported shipment statuses without case sensitivity', () => {
    expect(normalizeShipmentStatus('in_transit')).toBe('IN_TRANSIT');
    expect(normalizeShipmentStatus('delivered')).toBe('DELIVERED');
    expect(normalizeShipmentStatus('awaiting_picking')).toBe('AWAITING_PICKING');
  });

  it('does not interpret missing or unsupported statuses as delivered', () => {
    expect(normalizeShipmentStatus(undefined)).toBe('UNKNOWN');
    expect(normalizeShipmentStatus('CREATED')).toBe('UNKNOWN');
  });
});
