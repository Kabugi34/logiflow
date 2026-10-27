export type DriverAccountStatus = 'INVITED' | 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'INVITATION_EXPIRED';
export type DriverOperationalStatus = 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
/** Legacy operations status retained for existing fleet summaries. */
export type DriverStatus = 'ACTIVE' | 'STANDBY' | 'DELAYED' | 'OFF_DUTY';
export type VehicleStatus = 'ACTIVE' | 'STANDBY' | 'MAINTENANCE' | 'IDLE' | 'OUT_OF_SERVICE';
export type VehicleCondition = 'READY' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export interface DriverActivity {
  tripId: string;
  title: string;
  destination: string;
  updatedAt: string;
}

export interface FleetDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  license: string;
  accountStatus: DriverAccountStatus;
  operationalStatus: DriverOperationalStatus;
  status: DriverStatus;
  baseWarehouseId: string | null;
  invitationResends: number;
  invitationStatus?: 'QUEUED' | 'SENT' | 'FAILED';
  vehicleId: string | null;
  currentTripId: string | null;
  currentLocation: string;
  latitude: number;
  longitude: number;
  routeZone: string;
  slaPerformance: number;
  deliveriesCompleted: number;
  deliveriesPending: number;
  recentActivity: DriverActivity[];
}

export interface FleetVehicle {
  id: string;
  plate: string;
  type: string;
  maxWeightCapacity: number;
  condition: VehicleCondition;
  assignedDriverId: string | null;
  currentTripId: string | null;
}

export interface NewFleetDriver {
  name: string;
  email: string;
  phone: string;
  license: string;
  baseWarehouseId?: string;
  vehicleId?: string;
}

export interface NewFleetVehicle {
  plate: string;
  type: string;
  maxWeightCapacity: number;
}
