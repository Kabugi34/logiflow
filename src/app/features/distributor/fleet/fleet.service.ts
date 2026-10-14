import { computed, Injectable, signal } from '@angular/core';
import { DistributorDriver, DistributorVehicle } from './fleet.models';

const HOME_WAREHOUSE = '';
const initialVehicles: DistributorVehicle[] = [];
const initialDrivers: DistributorDriver[] = [];

@Injectable({ providedIn: 'root' })
export class DistributorFleetService {
  private readonly vehicleRecords = signal(initialVehicles);
  private readonly driverRecords = signal(initialDrivers);

  readonly vehicles = this.vehicleRecords.asReadonly();
  readonly drivers = this.driverRecords.asReadonly();
  readonly availableVehicles = computed(() => this.vehicleRecords().filter(vehicle => vehicle.status === 'AVAILABLE'));
  readonly standbyDrivers = computed(() => this.driverRecords().filter(driver => driver.status === 'STANDBY'));
  readonly activeVehicles = computed(() => this.vehicleRecords().filter(vehicle => vehicle.status === 'ON_TRIP'));

  findVehicle(id: string | undefined): DistributorVehicle | undefined {
    return this.vehicleRecords().find(vehicle => vehicle.id === id);
  }

  findDriver(id: string | undefined): DistributorDriver | undefined {
    return this.driverRecords().find(driver => driver.id === id);
  }

  assign(orderId: string, vehicleId: string, driverId: string): void {
    const vehicle = this.findVehicle(vehicleId);
    const driver = this.findDriver(driverId);
    if (!vehicle || vehicle.status !== 'AVAILABLE') throw new Error('Select an available fleet truck.');
    if (!driver || driver.status !== 'STANDBY') throw new Error('Select a driver on standby.');

    const locationLabel = `Departing ${HOME_WAREHOUSE}`;
    this.vehicleRecords.update(vehicles => vehicles.map(record => record.id === vehicleId
      ? { ...record, status: 'ON_TRIP', locationLabel, currentOrderId: orderId }
      : record));
    this.driverRecords.update(drivers => drivers.map(record => record.id === driverId
      ? { ...record, status: 'ON_TRIP', locationLabel, vehicleId, currentOrderId: orderId }
      : record));
  }

  release(orderId: string): void {
    this.vehicleRecords.update(vehicles => vehicles.map(record => record.currentOrderId === orderId
      ? { ...record, status: 'AVAILABLE', locationLabel: HOME_WAREHOUSE, currentOrderId: undefined }
      : record));
    this.driverRecords.update(drivers => drivers.map(record => record.currentOrderId === orderId
      ? { ...record, status: 'STANDBY', locationLabel: HOME_WAREHOUSE, vehicleId: undefined, currentOrderId: undefined }
      : record));
  }
}
