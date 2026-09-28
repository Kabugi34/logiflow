import { ShipmentRoutePoint } from '../shipments/shipment.models';

export type LogisticsTripStatus = 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED';

export interface LogisticsTrip {
  id: string;
  driver: string;
  vehicle: string;
  shipmentIds: string[];
  totalStops: number;
  completedStops: number;
  status: LogisticsTripStatus;
  currentLocation: string;
  route: ShipmentRoutePoint[];
}
