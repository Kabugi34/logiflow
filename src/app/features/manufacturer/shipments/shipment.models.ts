export type ShipmentStatus = 'READY_FOR_DISPATCH' | 'IN_TRANSIT' | 'DELIVERED' | 'RECEIVED' | 'CANCELLED' | 'BORDER_HOLD' | 'UNKNOWN';

export function normalizeShipmentStatus(status: unknown): ShipmentStatus {
  if (typeof status !== 'string') return 'UNKNOWN';

  switch (status.trim().toUpperCase()) {
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'READY_FOR_DISPATCH':
      return 'READY_FOR_DISPATCH';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'RECEIVED':
      return 'RECEIVED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'BORDER_HOLD':
      return 'BORDER_HOLD';
    default:
      return 'UNKNOWN';
  }
}

export interface ShipmentRoutePoint {
  latitude: number;
  longitude: number;
  label: string;
}

export interface ShipmentTimelineEvent {
  title: string;
  detail: string;
  state: 'COMPLETE' | 'CURRENT' | 'UPCOMING';
}

export interface ManufacturerShipment {
  id: string;
  purchaseOrderId?: string;
  destinationWarehouseId?: string;
  trackingNumber?: string | null;
  poReference: string;
  destination: string;
  freightDetails: string;
  quantity: number | null;
  unit: string;
  status: ShipmentStatus;
  tripId: string;
  assignedDriver: string;
  vehicle: string;
  carrier: string;
  origin: string;
  destinationFacility: string;
  route: ShipmentRoutePoint[];
  timeline: ShipmentTimelineEvent[];
}
