import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { map, tap } from 'rxjs';
import { ManufacturerFleetService } from '../fleet/fleet.service';
import { ManufacturerWarehouseService } from '../warehouses/warehouse.service';
import { DriverAccountStatus } from '../fleet/fleet.models';
import { Observable, throwError } from 'rxjs';
import { ManufacturerStaffMember, NewManufacturerEmployee, StaffStatus } from './staff.models';

const initialEmployees: ManufacturerStaffMember[] = [];
interface ApiMember { id: string; fullName?: string; name?: string; email: string; jobTitle?: string; warehouseId?: string | null; status?: StaffStatus; lastActiveAt?: string; }
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class ManufacturerStaffService {
  private readonly http = inject(HttpClient);
  private readonly fleetService = inject(ManufacturerFleetService);
  private readonly warehouseService = inject(ManufacturerWarehouseService);
  private readonly employeeRecords = signal(initialEmployees);

  constructor() { this.refreshEmployees(); }

  refreshEmployees(): void {
    this.http.get<ApiPage<ApiMember> | ApiMember[]>(`${API_ENDPOINTS.manufacturer.members}?size=100`).subscribe({
      next: result => this.employeeRecords.set((Array.isArray(result) ? result : result.content ?? []).map(row => {
        const warehouseId = row.warehouseId ?? null;
        return { id: row.id, name: row.fullName ?? row.name ?? '', email: row.email, jobTitle: row.jobTitle ?? '', accessRole: 'MANUFACTURER_STAFF',
          warehouseId, warehouseName: this.warehouseService.findById(warehouseId ?? '')?.name ?? 'Unassigned', status: row.status ?? 'PENDING',
          lastActive: row.lastActiveAt ?? (row.status === 'PENDING' ? 'Invite pending' : '—'), category: 'EMPLOYEE' };
      })),
      error: () => undefined
    });
  }

  readonly jobTitles = ['Cleaner', 'Warehouse Supervisor', 'Logistics Coordinator', 'Inventory Analyst', 'Gate Dispatch Controller'];
  readonly warehouses = this.warehouseService.warehouses;
  readonly members = computed(() => [
    ...this.employeeRecords(),
    ...this.fleetService.drivers().map(driver => {
      const warehouseId = driver.routeZone.includes('Coast') ? 'MBA-C4' : 'NBO-A1';
      const warehouse = this.warehouseService.findById(warehouseId);
      const emailName = driver.name.toLowerCase().replaceAll(' ', '.');
      return {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        jobTitle: 'Driver',
        accessRole: 'MANUFACTURER_STAFF' as const,
        warehouseId,
        warehouseName: warehouse?.name ?? 'Unassigned',
        status: driver.accountStatus === 'SUSPENDED' ? 'SUSPENDED' as const : driver.accountStatus === 'ACTIVE' ? 'ACTIVE' as const : 'PENDING' as const,
        lastActive: driver.currentTripId ? 'Just now' : driver.accountStatus === 'INVITED' ? 'Invite pending' : '—',
        category: 'DRIVER' as const
      };
    })
  ]);

  inviteEmployee(employee: NewManufacturerEmployee) {
    return this.http.post<{ id: string; fullName?: string; name?: string; email: string; jobTitle?: string; warehouseId?: string; status?: StaffStatus }>(API_ENDPOINTS.manufacturer.memberInvitations, {
      fullName: employee.name.trim(), email: employee.email.trim().toLowerCase(), jobTitle: employee.jobTitle, warehouseId: employee.warehouseId
    }).pipe(map(row => {
      const warehouse = this.warehouseService.findById(row.warehouseId ?? employee.warehouseId);
      return { id: row.id, name: row.fullName ?? row.name ?? employee.name, email: row.email, jobTitle: row.jobTitle ?? employee.jobTitle,
        accessRole: 'MANUFACTURER_STAFF' as const, warehouseId: row.warehouseId ?? employee.warehouseId, warehouseName: warehouse?.name ?? 'Unassigned',
        status: row.status ?? 'PENDING', lastActive: 'Invite sent', category: 'EMPLOYEE' as const };
    }), tap(member => this.employeeRecords.update(records => [member, ...records])));
  }

  updateEmployeeStatus(id: string, status: StaffStatus) {
    return this.http.patch(API_ENDPOINTS.manufacturer.memberStatus(id), { status }).pipe(tap(() => this.refreshEmployees()));
  }

  updateDriverStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Observable<unknown> {
    const driver = this.fleetService.findDriver(id);
    if (!driver) return throwError(() => new Error('Driver was not found.'));
    const action = status === 'SUSPENDED' ? 'SUSPEND' : driver.accountStatus === 'SUSPENDED' ? 'REACTIVATE' : 'APPROVE';
    return this.fleetService.driverActionApi(id, action);
  }
}
