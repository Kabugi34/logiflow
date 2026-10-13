import { computed, Injectable, signal } from '@angular/core';
import { DistributorDriver, DistributorVehicle } from './fleet.models';

const HOME_WAREHOUSE = 'Nairobi Distribution Centre';

const initialVehicles: DistributorVehicle[] = [
  { id: 'TRK-40912', model: 'Isuzu FVR', plate: 'KDA 123A', status: 'AVAILABLE', locationLabel: HOME_WAREHOUSE, latitude: -1.2864, longitude: 36.8172 },
  { id: 'TRK-09214', model: 'Mitsubishi Fuso Fighter', plate: 'KDB 456B', status: 'ON_TRIP', locationLabel: 'Mombasa Road outbound', latitude: -1.3451, longitude: 36.8502, currentOrderId: 'ORD-88104' },
  { id: 'TRK-33190', model: 'Hino 500 Series', plate: 'KDC 789C', status: 'ON_TRIP', locationLabel: 'Athi River logistics corridor', latitude: -1.4563, longitude: 36.9783, currentOrderId: 'ORD-33291' },
  { id: 'TRK-51420', model: 'Isuzu Giga', plate: 'KDD 234D', status: 'AVAILABLE', locationLabel: HOME_WAREHOUSE, latitude: -1.2921, longitude: 36.8219 },
  { id: 'TRK-61033', model: 'Toyota Dyna', plate: 'KDE 567E', status: 'MAINTENANCE', locationLabel: 'Service bay 2 · Industrial Area, Nairobi', latitude: -1.3167, longitude: 36.8500 }
];

const initialDrivers: DistributorDriver[] = [
  { id: 'DRV-101', name: 'Daniel Kamau', status: 'STANDBY', locationLabel: 'Mobile standby · Nairobi' },
  { id: 'DRV-102', name: 'Faith Njeri', status: 'ON_TRIP', locationLabel: 'Mombasa Road outbound', vehicleId: 'TRK-09214', currentOrderId: 'ORD-88104' },
  { id: 'DRV-103', name: 'Peter Otieno', status: 'ON_TRIP', locationLabel: 'Athi River logistics corridor', vehicleId: 'TRK-33190', currentOrderId: 'ORD-33291' },
  { id: 'DRV-104', name: 'Mary Wanjiku', status: 'STANDBY', locationLabel: HOME_WAREHOUSE }
];

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
