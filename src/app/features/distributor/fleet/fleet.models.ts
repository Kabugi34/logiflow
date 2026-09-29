export type VehicleStatus = 'AVAILABLE' | 'ON_TRIP' | 'MAINTENANCE';
export type DriverStatus = 'STANDBY' | 'ON_TRIP';

export interface DistributorVehicle {
  id: string;
  model: string;
  plate: string;
  status: VehicleStatus;
  locationLabel: string;
  latitude: number;
  longitude: number;
  currentOrderId?: string;
}

export interface DistributorDriver {
  id: string;
  name: string;
  status: DriverStatus;
  locationLabel: string;
  vehicleId?: string;
  currentOrderId?: string;
}
