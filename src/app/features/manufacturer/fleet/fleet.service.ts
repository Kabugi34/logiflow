import { computed, Injectable, signal } from '@angular/core';
import { DriverAccountStatus, DriverOperationalStatus, FleetDriver, FleetVehicle, NewFleetDriver, NewFleetVehicle, VehicleCondition, VehicleStatus } from './fleet.models';

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
      active: drivers.filter(driver => driver.accountStatus === 'ACTIVE').length,
      standby: drivers.filter(driver => driver.accountStatus === 'ACTIVE' && driver.operationalStatus === 'AVAILABLE').length,
      delayed: drivers.filter(driver => driver.operationalStatus === 'ON_TRIP').length
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
    const name = driver.name.trim();
    const email = driver.email.trim().toLowerCase();
    const phone = driver.phone.trim();
    const license = driver.license.trim().toUpperCase();
    if (this.driverRecords().some(row => row.license.toLowerCase() === license || row.phone === phone || row.email === email)) {
      throw new Error('A driver with this email, phone number, or license is already registered.');
    }
    const id = `DRV-${Date.now()}`;
    const record: FleetDriver = {
      id, name, email, phone, license, accountStatus: 'INVITED', operationalStatus: 'OFF_DUTY', status: 'OFF_DUTY',
      baseWarehouseId: driver.baseWarehouseId || null, invitationResends: 0, vehicleId: null, currentTripId: null,
      currentLocation: 'Manufacturer depot', latitude: -1.2864, longitude: 36.8172,
      routeZone: 'Nairobi', slaPerformance: 100, deliveriesCompleted: 0, deliveriesPending: 0, recentActivity: []
    };
    this.driverRecords.update(rows => [...rows, record]);
    return id;
  }

  updateDriverProfile(id: string, details: Pick<NewFleetDriver, 'name' | 'email' | 'phone' | 'license' | 'baseWarehouseId'>): boolean {
    const current = this.findDriver(id);
    if (!current || current.currentTripId) return false;
    const email = details.email.trim().toLowerCase();
    const license = details.license.trim().toUpperCase();
    if (this.driverRecords().some(row => row.id !== id && (row.email === email || row.phone === details.phone.trim() || row.license.toLowerCase() === license))) throw new Error('Another driver already uses one of these details.');
    this.driverRecords.update(rows => rows.map(row => row.id === id ? { ...row, name: details.name.trim(), email, phone: details.phone.trim(), license, baseWarehouseId: details.baseWarehouseId || null } : row));
    return true;
  }

  transitionDriverAccount(id: string, action: 'APPROVE' | 'REJECT' | 'RESEND' | 'REVOKE' | 'SUSPEND' | 'REACTIVATE'): boolean {
    const driver = this.findDriver(id);
    if (!driver) return false;
    if (action === 'APPROVE' && driver.accountStatus === 'PENDING_APPROVAL') return this.setAccountStatus(id, 'ACTIVE', 'AVAILABLE');
    if (action === 'REJECT' && driver.accountStatus === 'PENDING_APPROVAL') { this.driverRecords.update(rows => rows.filter(row => row.id !== id)); return true; }
    if (action === 'RESEND' && ['INVITED', 'INVITATION_EXPIRED'].includes(driver.accountStatus)) {
      this.driverRecords.update(rows => rows.map(row => row.id === id ? { ...row, accountStatus: 'INVITED', invitationResends: row.invitationResends + 1 } : row)); return true;
    }
    if (action === 'REVOKE' && ['INVITED', 'INVITATION_EXPIRED'].includes(driver.accountStatus)) { this.driverRecords.update(rows => rows.filter(row => row.id !== id)); return true; }
    if (action === 'SUSPEND' && driver.accountStatus === 'ACTIVE' && !driver.currentTripId) return this.setAccountStatus(id, 'SUSPENDED', 'OFF_DUTY');
    if (action === 'REACTIVATE' && driver.accountStatus === 'SUSPENDED') return this.setAccountStatus(id, 'ACTIVE', 'AVAILABLE');
    return false;
  }

  private setAccountStatus(id: string, accountStatus: DriverAccountStatus, operationalStatus: DriverOperationalStatus): boolean {
    const status = operationalStatus === 'ON_TRIP' ? 'ACTIVE' : operationalStatus === 'AVAILABLE' ? 'STANDBY' : 'OFF_DUTY';
    this.driverRecords.update(rows => rows.map(row => row.id === id ? { ...row, accountStatus, operationalStatus, status, currentLocation: accountStatus === 'SUSPENDED' ? 'Access suspended' : row.currentLocation } : row));
    return true;
  }

  updateDriverOperationalStatus(id: string, status: DriverOperationalStatus): boolean {
    const driver = this.findDriver(id);
    if (!driver || driver.accountStatus !== 'ACTIVE' || driver.currentTripId || status === 'ON_TRIP') return false;
    this.driverRecords.update(rows => rows.map(row => row.id === id ? { ...row, operationalStatus: status, status: status === 'AVAILABLE' ? 'STANDBY' : 'OFF_DUTY' } : row));
    return true;
  }

  registerVehicle(vehicle: NewFleetVehicle): void {
    const plate = vehicle.plate.trim().toUpperCase();
    if (this.vehicleRecords().some(row => row.plate.toUpperCase() === plate)) throw new Error('A vehicle with this registration is already in the fleet.');
    this.vehicleRecords.update(rows => [...rows, {
      id: `VEH-${Date.now()}`, plate, type: vehicle.type.trim(), maxWeightCapacity: vehicle.maxWeightCapacity,
      condition: 'READY', assignedDriverId: null, currentTripId: null
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
      targetDriver.accountStatus !== 'ACTIVE' || targetDriver.operationalStatus !== 'AVAILABLE'
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
      driver.accountStatus !== 'ACTIVE' || driver.operationalStatus !== 'AVAILABLE' ||
      driver.currentTripId !== null ||
      vehicle.assignedDriverId !== driver.id ||
      vehicle.currentTripId !== null ||
      this.vehicleStatus(vehicle) !== 'STANDBY'
    ) return false;

    this.driverRecords.update(drivers => drivers.map(record => record.id === driverId
        ? { ...record, operationalStatus: 'ON_TRIP', status: 'ACTIVE', currentTripId: tripId }
      : record));
    this.vehicleRecords.update(vehicles => vehicles.map(record => record.id === vehicle.id
      ? { ...record, currentTripId: tripId }
      : record));
    return true;
  }

  completeTrip(tripId: string): void {
    this.driverRecords.update(drivers => drivers.map(driver => driver.currentTripId === tripId
      ? { ...driver, operationalStatus: 'AVAILABLE', status: 'STANDBY', currentTripId: null, deliveriesCompleted: driver.deliveriesCompleted + 1 }
      : driver));
    this.vehicleRecords.update(vehicles => vehicles.map(vehicle => vehicle.currentTripId === tripId
      ? { ...vehicle, currentTripId: null }
      : vehicle));
  }

  updateDriverStatus(driverId: string, status: DriverOperationalStatus): boolean {
    const driver = this.findDriver(driverId);
    if (!driver || driver.currentTripId || driver.accountStatus !== 'ACTIVE' || status === 'ON_TRIP') return false;
    if (status === 'OFF_DUTY') {
      const vehicle = this.getVehicleForDriver(driverId);
      if (vehicle && !this.assignDriver(vehicle.id, null)) return false;
    }
    this.driverRecords.update(rows => rows.map(row => row.id === driverId ? { ...row, operationalStatus: status, status: status === 'AVAILABLE' ? 'STANDBY' : 'OFF_DUTY' } : row));
    return true;
  }

  updateVehicleCondition(vehicleId: string, condition: VehicleCondition): boolean {
    const vehicle = this.findVehicle(vehicleId);
    if (!vehicle || vehicle.currentTripId || !['READY', 'MAINTENANCE', 'OUT_OF_SERVICE'].includes(condition)) return false;
    if (condition !== 'READY' && vehicle.assignedDriverId && !this.assignDriver(vehicleId, null)) return false;
    this.vehicleRecords.update(rows => rows.map(row => row.id === vehicleId ? { ...row, condition } : row));
    return true;
  }

  pingDriver(driverId: string): void {
    if (this.findDriver(driverId)) this.lastPingedDriverId.set(driverId);
  }
}

