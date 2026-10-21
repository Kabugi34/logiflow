import { computed, Injectable, signal } from '@angular/core';
import { DriverStatus, FleetDriver, FleetVehicle, NewFleetDriver, NewFleetVehicle, VehicleCondition, VehicleStatus } from './fleet.models';

const initialDrivers: FleetDriver[] = [];
const initialVehicles: FleetVehicle[] = [];

@Injectable({ providedIn: 'root' })
export class ManufacturerFleetService {
  private readonly driverRecords = signal(initialDrivers);
  private readonly vehicleRecords = signal(initialVehicles);
  private readonly lastPingedDriverId = signal<string | null>(null);

  readonly drivers = this.driverRecords.asReadonly();
  readonly vehicles = this.vehicleRecords.asReadonly();
  readonly pingedDriverId = this.lastPingedDriverId.asReadonly();

  readonly driverMetrics = computed(() => {
    const drivers = this.driverRecords();
    return {
      total: drivers.length,
      active: drivers.filter(driver => driver.status === 'ACTIVE').length,
      standby: drivers.filter(driver => driver.status === 'STANDBY').length,
      delayed: drivers.filter(driver => driver.status === 'DELAYED').length
    };
  });

  readonly vehicleMetrics = computed(() => {
    const vehicles = this.vehicleRecords();
    return {
      total: vehicles.length,
      active: vehicles.filter(vehicle => this.vehicleStatus(vehicle) === 'ACTIVE').length,
      standby: vehicles.filter(vehicle => this.vehicleStatus(vehicle) === 'STANDBY').length,
      maintenance: vehicles.filter(vehicle => this.vehicleStatus(vehicle) === 'MAINTENANCE').length,
      unavailable: vehicles.filter(vehicle => this.vehicleStatus(vehicle) === 'OUT_OF_SERVICE').length
    };
  });

  findDriver(id: string): FleetDriver | undefined {
    return this.driverRecords().find(driver => driver.id === id);
  }

  findVehicle(id: string): FleetVehicle | undefined {
    return this.vehicleRecords().find(vehicle => vehicle.id === id);
  }

  getVehicleForDriver(driverId: string): FleetVehicle | undefined {
    return this.vehicleRecords().find(vehicle => vehicle.assignedDriverId === driverId);
  }

  vehicleStatus(vehicle: FleetVehicle): VehicleStatus {
    if (vehicle.condition === 'MAINTENANCE' || vehicle.condition === 'OUT_OF_SERVICE') return vehicle.condition;
    if (vehicle.currentTripId) return 'ACTIVE';
    if (vehicle.assignedDriverId) return 'STANDBY';
    return 'IDLE';
  }

  onboardDriver(driver: NewFleetDriver): string {
    void driver;
    throw new Error('Driver onboarding is unavailable because the backend has no fleet API yet.');
  }

  registerVehicle(vehicle: NewFleetVehicle): void {
    void vehicle;
    throw new Error('Vehicle registration is unavailable because the backend has no fleet API yet.');
  }

  assignDriver(vehicleId: string, driverId: string | null): boolean {
    void vehicleId; void driverId;
    return false;
    /* Local-only fleet assignment removed; implement against a backend fleet endpoint when available.
    const targetVehicle = this.vehicleRecords().find(vehicle => vehicle.id === vehicleId);
    if (!targetVehicle) return false;
    const currentDriver = targetVehicle.assignedDriverId
      ? this.driverRecords().find(driver => driver.id === targetVehicle.assignedDriverId)
      : undefined;

    if (driverId === null) {
      if (targetVehicle.currentTripId || !currentDriver) return false;
      this.vehicleRecords.update(vehicles => vehicles.map(vehicle => vehicle.id === vehicleId
        ? { ...vehicle, assignedDriverId: null }
        : vehicle));
      this.driverRecords.update(drivers => drivers.map(driver => driver.id === currentDriver.id
        ? { ...driver, vehicleId: null }
        : driver));
      return true;
    }

    const targetDriver = this.driverRecords().find(driver => driver.id === driverId);
    if (
      !targetDriver ||
      targetVehicle.assignedDriverId !== null ||
      targetVehicle.currentTripId !== null ||
      targetVehicle.condition !== 'READY' ||
      this.vehicleStatus(targetVehicle) !== 'IDLE' ||
      targetDriver.vehicleId !== null ||
      targetDriver.currentTripId !== null ||
      !['INVITED', 'STANDBY'].includes(targetDriver.status)
    ) return false;

    this.vehicleRecords.update(vehicles => vehicles.map(vehicle => vehicle.id === vehicleId
      ? { ...vehicle, assignedDriverId: driverId }
      : vehicle));
    this.driverRecords.update(drivers => drivers.map(driver => driver.id === driverId
      ? { ...driver, vehicleId }
      : driver));
    return true; */
  }

  dispatchDriver(driverId: string, tripId: string): boolean {
    void driverId; void tripId;
    return false;
    /* Local-only dispatch removed; trip assignment must be persisted by the backend.
    const driver = this.driverRecords().find(record => record.id === driverId);
    const vehicle = driver?.vehicleId
      ? this.vehicleRecords().find(record => record.id === driver.vehicleId)
      : undefined;
    if (
      !driver ||
      !vehicle ||
      driver.status !== 'STANDBY' ||
      driver.currentTripId !== null ||
      vehicle.assignedDriverId !== driver.id ||
      vehicle.currentTripId !== null ||
      this.vehicleStatus(vehicle) !== 'STANDBY'
    ) return false;

    this.driverRecords.update(drivers => drivers.map(record => record.id === driverId
      ? { ...record, status: 'ACTIVE', currentTripId: tripId }
      : record));
    this.vehicleRecords.update(vehicles => vehicles.map(record => record.id === vehicle.id
      ? { ...record, currentTripId: tripId }
      : record));
    return true; */
  }

  completeTrip(tripId: string): void {
    void tripId;
  }

  updateDriverStatus(driverId: string, status: DriverStatus): boolean {
    void driverId; void status;
    return false;
    return true;
  }

  updateVehicleCondition(vehicleId: string, condition: VehicleCondition): boolean {
    void vehicleId; void condition;
    return false;
  }

  pingDriver(driverId: string): void {
    void driverId;
  }
}
