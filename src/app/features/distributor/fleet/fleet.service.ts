import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { Observable, map, tap } from 'rxjs';
import {
  DistributorDriver,
  DistributorVehicle,
  DriverAccountStatus,
  DriverOperationalStatus,
} from './fleet.models';

interface DriverApiRow { id: string; fullName?: string; name?: string; email?: string; phoneNumber?: string; phone?: string; licenseNumber?: string; license?: string; accountStatus?: DriverAccountStatus; operationalStatus?: DriverOperationalStatus; baseWarehouseId?: string | null; createdAt?: string; vehicleId?: string; invitationStatus?: 'QUEUED' | 'SENT' | 'FAILED'; }
interface VehicleApiRow { id: string; model?: string; type?: string; plate?: string; registrationNumber?: string; status?: DistributorVehicle['status']; locationLabel?: string; latitude?: number; longitude?: number; }
interface Page<T> { content?: T[]; }

const HOME_WAREHOUSE = 'Nairobi Distribution Hub';
const initialVehicles: DistributorVehicle[] = [];
const initialDrivers: DistributorDriver[] = [];

@Injectable({ providedIn: 'root' })
export class DistributorFleetService {
  private readonly http = inject(HttpClient);
  private readonly vehicleRecords = signal(initialVehicles);
  private readonly driverRecords = signal(initialDrivers);
  readonly vehicles = this.vehicleRecords.asReadonly();
  readonly drivers = this.driverRecords.asReadonly();
  readonly availableVehicles = computed(() =>
    this.vehicleRecords().filter((vehicle) => vehicle.status === 'AVAILABLE'),
  );
  readonly standbyDrivers = computed(() =>
    this.driverRecords().filter(
      (driver) => driver.accountStatus === 'ACTIVE' && driver.operationalStatus === 'AVAILABLE',
    ),
  );
  readonly activeVehicles = computed(() =>
    this.vehicleRecords().filter((vehicle) => vehicle.status === 'ON_TRIP'),
  );
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() { this.refresh(); }

  createDriver(details: { name: string; email: string; phone: string; license: string; baseWarehouseId?: string }): Observable<DistributorDriver> {
    return this.http.post<DriverApiRow>(API_ENDPOINTS.distributor.drivers, {
      fullName: details.name.trim(), email: details.email.trim().toLowerCase(), phoneNumber: details.phone.trim(),
      licenseNumber: details.license.trim().toUpperCase(), baseWarehouseId: details.baseWarehouseId || null
    }).pipe(map(row => this.mapDriver(row)), tap(driver => this.driverRecords.update(rows => [driver, ...rows])));
  }

  saveDriverProfile(id: string, details: { name: string; phone: string; license: string; baseWarehouseId?: string }): Observable<DistributorDriver> {
    return this.http.patch<DriverApiRow>(API_ENDPOINTS.distributor.driver(id), {
      fullName: details.name.trim(), phoneNumber: details.phone.trim(), licenseNumber: details.license.trim().toUpperCase(), baseWarehouseId: details.baseWarehouseId || null
    }).pipe(map(row => this.mapDriver(row)), tap(updated => this.driverRecords.update(rows => rows.map(row => row.id === id ? updated : row))));
  }

  runDriverAction(id: string, action: 'APPROVE' | 'REJECT' | 'RESEND' | 'REVOKE' | 'SUSPEND' | 'REACTIVATE'): Observable<unknown> {
    if (action === 'RESEND') return this.http.post(API_ENDPOINTS.distributor.driverInvitationResend(id), {}).pipe(tap(() => this.refresh()));
    if (action === 'REVOKE') return this.http.delete(API_ENDPOINTS.distributor.driverInvitation(id)).pipe(tap(() => this.refresh()));
    if (action === 'SUSPEND' || action === 'REACTIVATE') return this.http.patch(API_ENDPOINTS.distributor.driverStatus(id), { status: action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE' }).pipe(tap(() => this.refresh()));
    return this.http.patch(API_ENDPOINTS.distributor.driverApplicationDecision(id), { decision: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' }).pipe(tap(() => this.refresh()));
  }

  setDriverOperationalStatus(id: string, status: 'AVAILABLE' | 'OFF_DUTY'): Observable<unknown> {
    return this.http.patch(API_ENDPOINTS.distributor.driverOperationalStatus(id), { status }).pipe(tap(() => this.refresh()));
  }

  createVehicle(details: { model: string; plate: string }): Observable<DistributorVehicle> {
    return this.http.post<VehicleApiRow>(API_ENDPOINTS.distributor.vehicles, { model: details.model.trim(), plate: details.plate.trim().toUpperCase() })
      .pipe(map(row => this.mapVehicle(row)), tap(vehicle => this.vehicleRecords.update(rows => [vehicle, ...rows])));
  }

  setVehicleStatus(id: string, status: 'AVAILABLE' | 'MAINTENANCE' | 'OUT_OF_SERVICE'): Observable<unknown> {
    return this.http.patch(API_ENDPOINTS.distributor.vehicleStatus(id), { status }).pipe(tap(() => this.refresh()));
  }

  private mapDriver(row: DriverApiRow): DistributorDriver {
    const operationalStatus = row.operationalStatus ?? 'OFF_DUTY';
    return { id: row.id, name: row.fullName ?? row.name ?? '', email: row.email ?? '', phone: row.phoneNumber ?? row.phone ?? '',
      license: row.licenseNumber ?? row.license ?? '', accountStatus: row.accountStatus ?? 'INVITED', operationalStatus,
      status: operationalStatus === 'AVAILABLE' ? 'STANDBY' : operationalStatus === 'ON_TRIP' ? 'ON_TRIP' : 'OFF_DUTY',
      baseWarehouseId: row.baseWarehouseId ?? null, invitationResends: 0, invitationStatus: row.invitationStatus, locationLabel: '', createdAt: row.createdAt ?? '', vehicleId: row.vehicleId };
  }

  private mapVehicle(row: VehicleApiRow): DistributorVehicle {
    return { id: row.id, model: row.model ?? row.type ?? '', plate: row.plate ?? row.registrationNumber ?? '', status: row.status ?? 'AVAILABLE', locationLabel: row.locationLabel ?? '', latitude: row.latitude ?? 0, longitude: row.longitude ?? 0 };
  }

  refresh(): void {
    this.loading.set(true);
    let completed = 0;
    const done = () => { completed++; if (completed === 2) this.loading.set(false); };
    this.http.get<Page<DriverApiRow> | DriverApiRow[]>(`${API_ENDPOINTS.distributor.drivers}?size=100`).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.driverRecords.set(rows.map(row => ({
          id: row.id, name: row.fullName ?? row.name ?? '', email: row.email ?? '', phone: row.phoneNumber ?? row.phone ?? '',
          license: row.licenseNumber ?? row.license ?? '', accountStatus: row.accountStatus ?? 'INVITED',
          operationalStatus: row.operationalStatus ?? 'OFF_DUTY', status: row.operationalStatus === 'AVAILABLE' ? 'STANDBY' : row.operationalStatus === 'ON_TRIP' ? 'ON_TRIP' : 'OFF_DUTY',
          baseWarehouseId: row.baseWarehouseId ?? null, invitationResends: 0, locationLabel: '', createdAt: row.createdAt ?? '', vehicleId: row.vehicleId
        })));
        done();
      }, error: () => { this.error.set('Driver directory API is unavailable.'); done(); }
    });
    this.http.get<Page<VehicleApiRow> | VehicleApiRow[]>(`${API_ENDPOINTS.distributor.vehicles}?size=100`).subscribe({
      next: result => {
        const rows = Array.isArray(result) ? result : result.content ?? [];
        this.vehicleRecords.set(rows.map(row => ({ id: row.id, model: row.model ?? row.type ?? '', plate: row.plate ?? row.registrationNumber ?? '', status: row.status ?? 'AVAILABLE', locationLabel: row.locationLabel ?? '', latitude: row.latitude ?? 0, longitude: row.longitude ?? 0 })));
        done();
      }, error: () => { this.error.set('Vehicle directory API is unavailable.'); done(); }
    });
  }

  findVehicle(id: string | undefined): DistributorVehicle | undefined {
    return this.vehicleRecords().find((vehicle) => vehicle.id === id);
  }
  findDriver(id: string | undefined): DistributorDriver | undefined {
    return this.driverRecords().find((driver) => driver.id === id);
  }

  onboardDriver(
    details: Pick<DistributorDriver, 'name' | 'email' | 'phone' | 'license'> & {
      baseWarehouseId?: string;
    },
  ): DistributorDriver {
    const email = details.email.trim().toLowerCase();
    const phone = details.phone.trim();
    const license = details.license.trim().toUpperCase();
    if (
      this.driverRecords().some(
        (driver) =>
          driver.email === email ||
          driver.phone === phone ||
          driver.license.toUpperCase() === license,
      )
    )
      throw new Error('A driver with this email, phone, or license is already on the roster.');
    const driver: DistributorDriver = {
      id: `DVR-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      name: details.name.trim(),
      email,
      phone,
      license,
      accountStatus: 'INVITED',
      operationalStatus: 'OFF_DUTY',
      status: 'OFF_DUTY',
      baseWarehouseId: details.baseWarehouseId || null,
      invitationResends: 0,
      locationLabel: 'Awaiting activation',
      createdAt: new Date().toISOString(),
    };
    this.driverRecords.update((rows) => [...rows, driver]);
    return driver;
  }

  updateDriverProfile(
    id: string,
    details: Pick<DistributorDriver, 'name' | 'email' | 'phone' | 'license' | 'baseWarehouseId'>,
  ): boolean {
    const existing = this.findDriver(id);
    if (!existing || existing.operationalStatus === 'ON_TRIP') return false;
    const email = details.email.trim().toLowerCase();
    const license = details.license.trim().toUpperCase();
    if (
      this.driverRecords().some(
        (row) =>
          row.id !== id &&
          (row.email === email ||
            row.license.toUpperCase() === license ||
            row.phone === details.phone.trim()),
      )
    )
      throw new Error('Another driver already uses one of these details.');
    this.driverRecords.update((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              name: details.name.trim(),
              email,
              phone: details.phone.trim(),
              license,
              baseWarehouseId: details.baseWarehouseId || null,
            }
          : row,
      ),
    );
    return true;
  }

  transitionDriverAccount(
    id: string,
    action: 'APPROVE' | 'REJECT' | 'RESEND' | 'REVOKE' | 'SUSPEND' | 'REACTIVATE',
  ): boolean {
    const driver = this.findDriver(id);
    if (!driver) return false;
    if (action === 'APPROVE' && driver.accountStatus === 'PENDING_APPROVAL')
      return this.setAccountStatus(id, 'ACTIVE', 'AVAILABLE');
    if (action === 'REJECT' && driver.accountStatus === 'PENDING_APPROVAL') {
      this.driverRecords.update((rows) => rows.filter((row) => row.id !== id));
      return true;
    }
    if (action === 'RESEND' && ['INVITED', 'INVITATION_EXPIRED'].includes(driver.accountStatus)) {
      this.driverRecords.update((rows) =>
        rows.map((row) =>
          row.id === id
            ? { ...row, accountStatus: 'INVITED', invitationResends: row.invitationResends + 1 }
            : row,
        ),
      );
      return true;
    }
    if (action === 'REVOKE' && ['INVITED', 'INVITATION_EXPIRED'].includes(driver.accountStatus)) {
      this.driverRecords.update((rows) => rows.filter((row) => row.id !== id));
      return true;
    }
    if (
      action === 'SUSPEND' &&
      driver.accountStatus === 'ACTIVE' &&
      driver.operationalStatus !== 'ON_TRIP'
    ) {
      if (driver.vehicleId)
        this.vehicleRecords.update((rows) =>
          rows.map((vehicle) =>
            vehicle.id === driver.vehicleId
              ? { ...vehicle, status: 'AVAILABLE', currentOrderId: undefined }
              : vehicle,
          ),
        );
      this.driverRecords.update((rows) =>
        rows.map((row) =>
          row.id === id
            ? {
                ...row,
                accountStatus: 'SUSPENDED',
                operationalStatus: 'OFF_DUTY',
                status: 'OFF_DUTY',
                vehicleId: undefined,
                locationLabel: 'Access suspended',
              }
            : row,
        ),
      );
      return true;
    }
    if (action === 'REACTIVATE' && driver.accountStatus === 'SUSPENDED')
      return this.setAccountStatus(id, 'ACTIVE', 'AVAILABLE');
    return false;
  }

  private setAccountStatus(
    id: string,
    accountStatus: DriverAccountStatus,
    operationalStatus: DriverOperationalStatus,
  ): boolean {
    const status =
      operationalStatus === 'ON_TRIP'
        ? 'ON_TRIP'
        : operationalStatus === 'AVAILABLE'
          ? 'STANDBY'
          : 'OFF_DUTY';
    this.driverRecords.update((rows) =>
      rows.map((row) =>
        row.id === id
          ? { ...row, accountStatus, operationalStatus, status, locationLabel: HOME_WAREHOUSE }
          : row,
      ),
    );
    return true;
  }

  updateDriverOperationalStatus(id: string, status: DriverOperationalStatus): boolean {
    const driver = this.findDriver(id);
    if (
      !driver ||
      driver.accountStatus !== 'ACTIVE' ||
      driver.operationalStatus === 'ON_TRIP' ||
      status === 'ON_TRIP'
    )
      return false;
    this.driverRecords.update((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              operationalStatus: status,
              status: status === 'AVAILABLE' ? 'STANDBY' : 'OFF_DUTY',
              locationLabel: status === 'OFF_DUTY' ? 'Off duty' : HOME_WAREHOUSE,
            }
          : row,
      ),
    );
    return true;
  }

  assign(orderId: string, vehicleId: string, driverId: string): void {
    const vehicle = this.findVehicle(vehicleId);
    const driver = this.findDriver(driverId);
    if (!vehicle || vehicle.status !== 'AVAILABLE')
      throw new Error('Select an available fleet truck.');
    if (!driver || driver.accountStatus !== 'ACTIVE' || driver.operationalStatus !== 'AVAILABLE')
      throw new Error('Select an active available driver.');
    this.vehicleRecords.update((rows) =>
      rows.map((row) =>
        row.id === vehicleId
          ? {
              ...row,
              status: 'ON_TRIP',
              locationLabel: `Departing ${HOME_WAREHOUSE}`,
              currentOrderId: orderId,
            }
          : row,
      ),
    );
    this.driverRecords.update((rows) =>
      rows.map((row) =>
        row.id === driverId
          ? {
              ...row,
              operationalStatus: 'ON_TRIP',
              status: 'ON_TRIP',
              locationLabel: `Departing ${HOME_WAREHOUSE}`,
              vehicleId,
              currentOrderId: orderId,
            }
          : row,
      ),
    );
  }

  registerVehicle(details: { model: string; plate: string }): DistributorVehicle {
    const plate = details.plate.trim().toUpperCase();
    if (this.vehicleRecords().some((vehicle) => vehicle.plate.toUpperCase() === plate))
      throw new Error('A vehicle with this registration is already listed.');
    const vehicle: DistributorVehicle = {
      id: `vehicle-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      model: details.model.trim(),
      plate,
      status: 'AVAILABLE',
      locationLabel: HOME_WAREHOUSE,
      latitude: -1.2864,
      longitude: 36.8172,
    };
    this.vehicleRecords.update((rows) => [...rows, vehicle]);
    return vehicle;
  }

  updateVehicleStatus(id: string, status: 'AVAILABLE' | 'MAINTENANCE' | 'OUT_OF_SERVICE'): boolean {
    const vehicle = this.findVehicle(id);
    if (!vehicle || vehicle.status === 'ON_TRIP') return false;
    this.vehicleRecords.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, status } : row)),
    );
    return true;
  }

  release(orderId: string): void {
    this.vehicleRecords.update((rows) =>
      rows.map((row) =>
        row.currentOrderId === orderId
          ? {
              ...row,
              status: 'AVAILABLE',
              locationLabel: HOME_WAREHOUSE,
              currentOrderId: undefined,
            }
          : row,
      ),
    );
    this.driverRecords.update((rows) =>
      rows.map((row) =>
        row.currentOrderId === orderId
          ? {
              ...row,
              operationalStatus: 'AVAILABLE',
              status: 'STANDBY',
              locationLabel: HOME_WAREHOUSE,
              vehicleId: undefined,
              currentOrderId: undefined,
            }
          : row,
      ),
    );
  }
}
