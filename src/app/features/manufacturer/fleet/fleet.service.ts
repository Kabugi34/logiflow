import { computed, Injectable, signal } from '@angular/core';
import { DriverStatus, FleetDriver, FleetVehicle, NewFleetDriver, NewFleetVehicle, VehicleStatus } from './fleet.models';

const initialDrivers: FleetDriver[] = [
  {
    id: 'DRV-001', name: 'Alex Mercer', phone: '+1 (555) 392-1084', license: 'CDL-A #TX892', status: 'ACTIVE', vehicleId: 'VEH-001', currentTripId: 'TRP-8012', currentLocation: 'Chicago Terminal → New York Terminal', latitude: 41.8781, longitude: -87.6298, routeZone: 'North America East', slaPerformance: 98.4, deliveriesCompleted: 3, deliveriesPending: 2,
    recentActivity: [{ tripId: 'TRP-8012', title: 'TRP-8012 (In Transit)', destination: 'Chicago Terminal → New York Terminal', updatedAt: 'Active' }, { tripId: 'TRP-7721', title: 'TRP-7721 (Delivered)', destination: 'Detroit Depot → Chicago Gate #4', updatedAt: 'Sep 24' }]
  },
  {
    id: 'DRV-002', name: 'Sarah Connor', phone: '+1 (555) 812-4091', license: 'CDL-A #CA812', status: 'ACTIVE', vehicleId: 'VEH-002', currentTripId: 'TRP-8015', currentLocation: 'Sweetgrass Checkpoint', latitude: 47.6062, longitude: -122.3321, routeZone: 'North America West', slaPerformance: 94.8, deliveriesCompleted: 2, deliveriesPending: 3,
    recentActivity: [{ tripId: 'TRP-8015', title: 'TRP-8015 (Border Hold)', destination: 'Chicago Hub → Seattle Harbor Depot', updatedAt: 'Active' }]
  },
  {
    id: 'DRV-003', name: 'David Jenkins', phone: '+1 (555) 902-8812', license: 'CDL-A #IL445', status: 'STANDBY', vehicleId: 'VEH-003', currentTripId: null, currentLocation: 'Chicago Yard', latitude: 41.9012, longitude: -87.6585, routeZone: 'North America Central', slaPerformance: 97.1, deliveriesCompleted: 0, deliveriesPending: 0,
    recentActivity: [{ tripId: 'TRP-8010', title: 'TRP-8010 (Delivered)', destination: 'Houston Terminal → Chicago Gate #4', updatedAt: 'Sep 24' }]
  },
  {
    id: 'DRV-004', name: 'Elena Rostova', phone: '+1 (555) 234-9021', license: 'CDL-A #NY554', status: 'DELAYED', vehicleId: 'VEH-004', currentTripId: 'TRP-1049', currentLocation: 'Buffalo Border Checkpoint', latitude: 42.8864, longitude: -78.8784, routeZone: 'North America East', slaPerformance: 88.2, deliveriesCompleted: 1, deliveriesPending: 1,
    recentActivity: [{ tripId: 'TRP-1049', title: 'TRP-1049 (Delayed)', destination: 'Buffalo Border → Albany Depot', updatedAt: '12 min ago' }]
  },
  {
    id: 'DRV-005', name: 'Marcus Brody', phone: '+1 (555) 761-1200', license: 'CDL-A #FL801', status: 'OFF_DUTY', vehicleId: null, currentTripId: null, currentLocation: 'Off Duty', latitude: 27.9506, longitude: -82.4572, routeZone: 'North America Southeast', slaPerformance: 96.3, deliveriesCompleted: 0, deliveriesPending: 0,
    recentActivity: []
  }
];

const initialVehicles: FleetVehicle[] = [
  { id: 'VEH-001', plate: 'KEN-409-TXD', type: 'Kenworth T680 Semitruck', maxWeightCapacity: 80000, serviceStatus: 'ACTIVE', assignedDriverId: 'DRV-001', currentTripId: 'TRP-8012' },
  { id: 'VEH-002', plate: 'PET-812-OKL', type: 'Peterbilt 579 Hauler', maxWeightCapacity: 80000, serviceStatus: 'ACTIVE', assignedDriverId: 'DRV-002', currentTripId: 'TRP-8015' },
  { id: 'VEH-003', plate: 'FLN-556-WQE', type: 'Freightliner Cascadia', maxWeightCapacity: 65000, serviceStatus: 'MAINTENANCE', assignedDriverId: 'DRV-003', currentTripId: null },
  { id: 'VEH-004', plate: 'VOL-224-NYP', type: 'Volvo VNL Heavy Carrier', maxWeightCapacity: 82000, serviceStatus: 'ACTIVE', assignedDriverId: 'DRV-004', currentTripId: 'TRP-1049' },
  { id: 'VEH-005', plate: 'HIN-908-FLA', type: 'Hino 268 Box Truck', maxWeightCapacity: 26000, serviceStatus: 'IDLE', assignedDriverId: null, currentTripId: null },
  { id: 'VEH-006', plate: 'ISU-112-LAD', type: 'Isuzu NPR Flatbed', maxWeightCapacity: 19500, serviceStatus: 'OUT_OF_SERVICE', assignedDriverId: null, currentTripId: null }
];

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
      active: vehicles.filter(vehicle => vehicle.serviceStatus === 'ACTIVE').length,
      maintenance: vehicles.filter(vehicle => vehicle.serviceStatus === 'MAINTENANCE').length,
      unavailable: vehicles.filter(vehicle => vehicle.serviceStatus === 'OUT_OF_SERVICE').length
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

  onboardDriver(driver: NewFleetDriver): void {
    const duplicateLicense = this.driverRecords().some(record => record.license.toLowerCase() === driver.license.toLowerCase());
    if (duplicateLicense) throw new Error('A driver with this license is already registered.');
    this.driverRecords.update(records => [...records, {
      ...driver,
      id: `DRV-${String(records.length + 1).padStart(3, '0')}`,
      status: 'INVITED',
      vehicleId: null,
      currentTripId: null,
      currentLocation: 'Awaiting activation',
      latitude: 39.5,
      longitude: -98.35,
      routeZone: 'Unassigned',
      slaPerformance: 0,
      deliveriesCompleted: 0,
      deliveriesPending: 0,
      recentActivity: []
    }]);
  }

  registerVehicle(vehicle: NewFleetVehicle): void {
    const normalizedPlate = vehicle.plate.trim().toLowerCase();
    if (this.vehicleRecords().some(record => record.plate.toLowerCase() === normalizedPlate)) {
      throw new Error('A vehicle with this plate is already registered.');
    }
    this.vehicleRecords.update(records => [...records, {
      ...vehicle,
      plate: vehicle.plate.trim().toUpperCase(),
      id: `VEH-${String(records.length + 1).padStart(3, '0')}`,
      serviceStatus: 'IDLE',
      assignedDriverId: null,
      currentTripId: null
    }]);
  }

  assignDriver(vehicleId: string, driverId: string | null): void {
    const targetVehicle = this.vehicleRecords().find(vehicle => vehicle.id === vehicleId);
    if (!targetVehicle) return;
    if (
      (targetVehicle.currentTripId && driverId !== targetVehicle.assignedDriverId) ||
      (driverId !== null && (targetVehicle.serviceStatus === 'MAINTENANCE' || targetVehicle.serviceStatus === 'OUT_OF_SERVICE'))
    ) return;
    const targetDriver = driverId ? this.driverRecords().find(driver => driver.id === driverId) : undefined;
    if (driverId && !targetDriver) return;
    if (targetDriver && (targetDriver.status === 'INVITED' || targetDriver.status === 'OFF_DUTY')) return;
    if (targetDriver?.currentTripId && targetDriver.vehicleId !== vehicleId) return;

    this.vehicleRecords.update(vehicles => vehicles.map(vehicle => {
      const isTarget = vehicle.id === vehicleId;
      const isPreviousAssignment = driverId !== null && vehicle.assignedDriverId === driverId && !isTarget;
      if (!isTarget && !isPreviousAssignment) return vehicle;
      if (isPreviousAssignment) {
        return { ...vehicle, assignedDriverId: null, currentTripId: null, serviceStatus: vehicle.serviceStatus === 'MAINTENANCE' || vehicle.serviceStatus === 'OUT_OF_SERVICE' ? vehicle.serviceStatus : 'IDLE' };
      }
      const preserveUnavailableStatus = vehicle.serviceStatus === 'MAINTENANCE' || vehicle.serviceStatus === 'OUT_OF_SERVICE';
      return {
        ...vehicle,
        assignedDriverId: driverId,
        currentTripId: targetDriver?.currentTripId ?? null,
        serviceStatus: preserveUnavailableStatus ? vehicle.serviceStatus : targetDriver?.currentTripId ? 'ACTIVE' : 'IDLE'
      };
    }));

    this.driverRecords.update(drivers => drivers.map(driver => {
      if (driver.id === driverId) return { ...driver, vehicleId };
      if (driver.vehicleId === vehicleId) return { ...driver, vehicleId: null };
      return driver;
    }));
  }

  updateDriverStatus(driverId: string, status: DriverStatus): void {
    const driver = this.driverRecords().find(record => record.id === driverId);
    if (!driver) return;
    if (driver.currentTripId && (status === 'STANDBY' || status === 'OFF_DUTY' || status === 'INVITED')) return;
    this.driverRecords.update(drivers => drivers.map(record => record.id === driverId ? { ...record, status } : record));
  }

  updateVehicleStatus(vehicleId: string, status: VehicleStatus): void {
    this.vehicleRecords.update(vehicles => vehicles.map(vehicle => vehicle.id === vehicleId ? { ...vehicle, serviceStatus: status } : vehicle));
  }

  pingDriver(driverId: string): void {
    this.lastPingedDriverId.set(driverId);
  }
}
