export type DriverStatus = 'ACTIVE' | 'STANDBY' | 'DELAYED' | 'OFF_DUTY' | 'INVITED';
export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'IDLE' | 'OUT_OF_SERVICE';

export interface DriverActivity {
  tripId: string;
  title: string;
  destination: string;
  updatedAt: string;
}

export interface FleetDriver {
  id: string;
  name: string;
  phone: string;
  license: string;
  status: DriverStatus;
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
  serviceStatus: VehicleStatus;
  assignedDriverId: string | null;
  currentTripId: string | null;
}

export interface NewFleetDriver {
  name: string;
  phone: string;
  license: string;
}

export interface NewFleetVehicle {
  plate: string;
  type: string;
  maxWeightCapacity: number;
}
