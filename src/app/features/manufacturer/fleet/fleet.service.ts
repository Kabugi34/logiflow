import { computed, Injectable, signal } from '@angular/core';
import { DriverStatus, FleetDriver, FleetVehicle, NewFleetDriver, NewFleetVehicle, VehicleCondition, VehicleStatus } from './fleet.models';

const initialDrivers: FleetDriver[] = [
  {
    id: 'DRV-001', name: 'Daniel Kamau', phone: '+254 712 345 678', license: 'DL-KEN-001', status: 'ACTIVE', vehicleId: 'VEH-001', currentTripId: 'TRP-8012', currentLocation: 'Nairobi → Mombasa', latitude: -1.2864, longitude: 36.8172, routeZone: 'Coast Corridor', slaPerformance: 98.4, deliveriesCompleted: 3, deliveriesPending: 2,
    recentActivity: [{ tripId: 'TRP-8012', title: 'TRP-8012 (In Transit)', destination: 'Nairobi → Mombasa', updatedAt: 'Active' }, { tripId: 'TRP-7721', title: 'TRP-7721 (Delivered)', destination: 'Nakuru Depot → Nairobi Gate #4', updatedAt: 'Sep 24' }]
  },
  {
    id: 'DRV-002', name: 'Faith Njeri', phone: '+254 723 456 789', license: 'DL-KEN-002', status: 'ACTIVE', vehicleId: 'VEH-002', currentTripId: 'TRP-8015', currentLocation: 'Nairobi → Kisumu', latitude: -0.0917, longitude: 34.768, routeZone: 'Lake Region Corridor', slaPerformance: 94.8, deliveriesCompleted: 2, deliveriesPending: 3,
    recentActivity: [{ tripId: 'TRP-8015', title: 'TRP-8015 (Route Hold)', destination: 'Nairobi Hub → Kisumu Depot', updatedAt: 'Active' }]
  },
  {
    id: 'DRV-003', name: 'Peter Otieno', phone: '+254 734 567 890', license: 'DL-KEN-003', status: 'STANDBY', vehicleId: null, currentTripId: null, currentLocation: 'Nairobi Yard', latitude: -1.2921, longitude: 36.8219, routeZone: 'Central Kenya', slaPerformance: 97.1, deliveriesCompleted: 0, deliveriesPending: 0,
    recentActivity: [{ tripId: 'TRP-8010', title: 'TRP-8010 (Delivered)', destination: 'Mombasa Terminal → Nairobi Gate #4', updatedAt: 'Sep 24' }]
  },
  {
    id: 'DRV-004', name: 'Grace Wambui', phone: '+254 745 678 901', license: 'DL-KEN-004', status: 'DELAYED', vehicleId: 'VEH-004', currentTripId: 'TRP-1049', currentLocation: 'Athi River Checkpoint', latitude: -1.4563, longitude: 36.9783, routeZone: 'Eastern Bypass Corridor', slaPerformance: 88.2, deliveriesCompleted: 1, deliveriesPending: 1,
    recentActivity: [{ tripId: 'TRP-1049', title: 'TRP-1049 (Delayed)', destination: 'Athi River Checkpoint → Nakuru Depot', updatedAt: '12 min ago' }]
  },
  {
    id: 'DRV-005', name: 'Kevin Kiptoo', phone: '+254 756 789 012', license: 'DL-KEN-005', status: 'OFF_DUTY', vehicleId: null, currentTripId: null, currentLocation: 'Off Duty', latitude: -1.2864, longitude: 36.8172, routeZone: 'Unassigned', slaPerformance: 96.3, deliveriesCompleted: 0, deliveriesPending: 0,
    recentActivity: []
  }
];

const initialVehicles: FleetVehicle[] = [
  { id: 'VEH-001', plate: 'KDA 123A', type: 'Isuzu FVR Truck', maxWeightCapacity: 80000, condition: 'READY', assignedDriverId: 'DRV-001', currentTripId: 'TRP-8012' },
  { id: 'VEH-002', plate: 'KDB 456B', type: 'Mitsubishi Fuso Fighter', maxWeightCapacity: 80000, condition: 'READY', assignedDriverId: 'DRV-002', currentTripId: 'TRP-8015' },
  { id: 'VEH-003', plate: 'KDC 789C', type: 'Hino 500 Series', maxWeightCapacity: 65000, condition: 'MAINTENANCE', assignedDriverId: null, currentTripId: null },
  { id: 'VEH-004', plate: 'KDD 234D', type: 'Isuzu Giga Carrier', maxWeightCapacity: 82000, condition: 'READY', assignedDriverId: 'DRV-004', currentTripId: 'TRP-1049' },
  { id: 'VEH-005', plate: 'KDE 567E', type: 'Toyota Dyna Box Truck', maxWeightCapacity: 26000, condition: 'READY', assignedDriverId: null, currentTripId: null },
  { id: 'VEH-006', plate: 'KDF 890F', type: 'Isuzu N-Series Flatbed', maxWeightCapacity: 19500, condition: 'OUT_OF_SERVICE', assignedDriverId: null, currentTripId: null }
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
    const duplicateLicense = this.driverRecords().some(record => record.license.toLowerCase() === driver.license.toLowerCase());
    if (duplicateLicense) throw new Error('A driver with this license is already registered.');
    const assignedVehicle = driver.vehicleId ? this.findVehicle(driver.vehicleId) : undefined;
    if (driver.vehicleId && (
      !assignedVehicle ||
      assignedVehicle.assignedDriverId !== null ||
      assignedVehicle.currentTripId !== null ||
      assignedVehicle.condition !== 'READY' ||
      this.vehicleStatus(assignedVehicle) !== 'IDLE'
    )) {
      throw new Error('That vehicle is not available for assignment.');
    }

    const id = `DRV-${String(this.driverRecords().length + 1).padStart(3, '0')}`;
    this.driverRecords.update(records => [...records, {
      ...driver,
      id,
      status: 'INVITED',
      vehicleId: assignedVehicle?.id ?? null,
      currentTripId: null,
      currentLocation: 'Awaiting activation',
      latitude: -1.2864,
      longitude: 36.8172,
      routeZone: 'Unassigned',
      slaPerformance: 0,
      deliveriesCompleted: 0,
      deliveriesPending: 0,
      recentActivity: []
    }]);

    if (assignedVehicle) {
      this.vehicleRecords.update(vehicles => vehicles.map(vehicle =>
        vehicle.id === assignedVehicle.id ? { ...vehicle, assignedDriverId: id } : vehicle
      ));
    }

    return id;
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
      condition: 'READY',
      assignedDriverId: null,
      currentTripId: null
    }]);
  }

  assignDriver(vehicleId: string, driverId: string | null): boolean {
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
    return true;
  }

  dispatchDriver(driverId: string, tripId: string): boolean {
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
    return true;
  }

  completeTrip(tripId: string): void {
    this.driverRecords.update(drivers => drivers.map(driver => driver.currentTripId === tripId
      ? { ...driver, status: 'STANDBY', currentTripId: null }
      : driver));
    this.vehicleRecords.update(vehicles => vehicles.map(vehicle => vehicle.currentTripId === tripId
      ? { ...vehicle, currentTripId: null }
      : vehicle));
  }

  updateDriverStatus(driverId: string, status: DriverStatus): boolean {
    const driver = this.driverRecords().find(record => record.id === driverId);
    if (!driver) return false;
    if (driver.currentTripId && ['STANDBY', 'OFF_DUTY', 'INVITED', 'SUSPENDED'].includes(status)) return false;
    if (status === 'ACTIVE' && !driver.currentTripId) return false;

    if (status === 'SUSPENDED' && driver.vehicleId) {
      const vehicleId = driver.vehicleId;
      this.vehicleRecords.update(vehicles => vehicles.map(vehicle => vehicle.id === vehicleId
        ? { ...vehicle, assignedDriverId: null }
        : vehicle));
    }

    this.driverRecords.update(drivers => drivers.map(record => record.id === driverId
      ? { ...record, status, vehicleId: status === 'SUSPENDED' ? null : record.vehicleId }
      : record));
    return true;
  }

  updateVehicleCondition(vehicleId: string, condition: VehicleCondition): boolean {
    const vehicle = this.vehicleRecords().find(record => record.id === vehicleId);
    if (!vehicle || (condition !== 'READY' && (vehicle.assignedDriverId !== null || vehicle.currentTripId !== null))) {
      return false;
    }

    this.vehicleRecords.update(vehicles => vehicles.map(vehicle => vehicle.id === vehicleId ? { ...vehicle, condition } : vehicle));
    return true;
  }

  pingDriver(driverId: string): void {
    this.lastPingedDriverId.set(driverId);
  }
}
