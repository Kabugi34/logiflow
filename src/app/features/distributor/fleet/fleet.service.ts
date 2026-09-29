import { computed, Injectable, signal } from '@angular/core';
import { DistributorDriver, DistributorVehicle } from './fleet.models';

const HOME_WAREHOUSE = 'Chicago Warehouse';

const initialVehicles: DistributorVehicle[] = [
  { id: 'TRK-40912', model: 'Peterbilt 579', plate: '409-TXD', status: 'AVAILABLE', locationLabel: HOME_WAREHOUSE, latitude: 41.8527, longitude: -87.6512 },
  { id: 'TRK-09214', model: 'Freightliner Cascadia', plate: '812-OKL', status: 'ON_TRIP', locationLabel: 'Interstate 90 Eastbound', latitude: 41.7508, longitude: -87.5652, currentOrderId: 'ORD-88104' },
  { id: 'TRK-33190', model: 'Kenworth T680', plate: '556-WQE', status: 'ON_TRIP', locationLabel: 'I-294 detour near O’Hare', latitude: 41.9786, longitude: -87.9048, currentOrderId: 'ORD-33291' },
  { id: 'TRK-51420', model: 'Volvo VNL 760', plate: '220-BXR', status: 'AVAILABLE', locationLabel: HOME_WAREHOUSE, latitude: 41.8541, longitude: -87.6489 },
  { id: 'TRK-61033', model: 'International LT', plate: '731-PQA', status: 'MAINTENANCE', locationLabel: 'Service bay 2', latitude: 41.8512, longitude: -87.6530 }
];

const initialDrivers: DistributorDriver[] = [
  { id: 'DRV-101', name: 'Alex Mercer', status: 'STANDBY', locationLabel: 'Mobile standby' },
  { id: 'DRV-102', name: 'Sarah Connor', status: 'ON_TRIP', locationLabel: 'Interstate 90 Eastbound', vehicleId: 'TRK-09214', currentOrderId: 'ORD-88104' },
  { id: 'DRV-103', name: 'David Jenkins', status: 'ON_TRIP', locationLabel: 'I-294 detour near O’Hare', vehicleId: 'TRK-33190', currentOrderId: 'ORD-33291' },
  { id: 'DRV-104', name: 'Maria Lopez', status: 'STANDBY', locationLabel: HOME_WAREHOUSE }
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
