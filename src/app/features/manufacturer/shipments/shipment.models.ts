export type ShipmentStatus = 'IN_TRANSIT' | 'DELIVERED' | 'BORDER_HOLD';

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
  poReference: string;
  destination: string;
  freightDetails: string;
  quantity: number;
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
