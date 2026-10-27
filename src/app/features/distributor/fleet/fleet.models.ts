export type VehicleStatus = 'AVAILABLE' | 'ON_TRIP' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type DriverAccountStatus =
  'INVITED' | 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'INVITATION_EXPIRED';
export type DriverOperationalStatus = 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
/** Legacy alias used by dashboard summaries; onboarding state is accountStatus. */
export type DriverStatus = 'STANDBY' | 'ON_TRIP' | 'OFF_DUTY';

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
  email: string;
  phone: string;
  license: string;
  accountStatus: DriverAccountStatus;
  operationalStatus: DriverOperationalStatus;
  status: DriverStatus;
  baseWarehouseId: string | null;
  invitationResends: number;
  invitationStatus?: 'QUEUED' | 'SENT' | 'FAILED';
  locationLabel: string;
  createdAt: string;
  vehicleId?: string;
  currentOrderId?: string;
}
