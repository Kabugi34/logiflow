import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { map, tap } from 'rxjs';
import { ManufacturerWarehouseService } from '../warehouses/warehouse.service';
import { AuthService } from '../../../core/auth/auth.service';
import { StaffAccessRole } from './staff.models';
import { ManufacturerStaffMember, NewManufacturerEmployee, StaffStatus } from './staff.models';

const initialEmployees: ManufacturerStaffMember[] = [];
interface ApiMember { id: string; fullName?: string; name?: string; email: string; jobTitle?: string; warehouseId?: string | null; status?: StaffStatus; lastActiveAt?: string; role?: string; accessRole?: string; category?: string; }
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class ManufacturerStaffService {
  private readonly http = inject(HttpClient);
  private readonly warehouseService = inject(ManufacturerWarehouseService);
  private readonly auth = inject(AuthService);
  private readonly employeeRecords = signal(initialEmployees);

  constructor() { this.refreshEmployees(); }

  refreshEmployees(): void {
    this.http.get<ApiPage<ApiMember> | ApiMember[]>(`${API_ENDPOINTS.manufacturer.members}?size=100`).subscribe({
      next: result => {
        const members = (Array.isArray(result) ? result : result.content ?? [])
          .filter(row => !this.isDriver(row))
          .map(row => this.toEmployee(row));
        this.employeeRecords.set(this.deduplicateEmployees(members));
      },
      error: () => undefined
    });
  }

  readonly jobTitles = ['Cleaner', 'Warehouse Supervisor', 'Logistics Coordinator', 'Inventory Analyst', 'Gate Dispatch Controller'];
  readonly warehouses = computed(() =>
    this.warehouseService.warehouses().filter(warehouse => warehouse.status === 'ACTIVE'),
  );
  readonly members = computed(() => this.employeeRecords());

  private isDriver(row: ApiMember): boolean {
    return row.role?.toUpperCase() === 'DRIVER' || row.accessRole?.toUpperCase() === 'DRIVER'
      || row.category?.toUpperCase() === 'DRIVER' || row.jobTitle?.trim().toLowerCase() === 'driver';
  }

  private toEmployee(row: ApiMember): ManufacturerStaffMember {
    const warehouseId = row.warehouseId ?? null;
    const user = this.auth.user();
    const isCurrentUser = (!!user && String(user.id) === String(row.id))
      || (!!user?.email && user.email.trim().toLowerCase() === row.email.trim().toLowerCase());
    const role = row.accessRole ?? row.role;
    const accessRole: StaffAccessRole = isCurrentUser
      ? (user?.roles.includes('MANUFACTURER_ADMIN') ? 'MANUFACTURER_ADMIN' : 'MANUFACTURER_STAFF')
      : role === 'MANUFACTURER_ADMIN' ? 'MANUFACTURER_ADMIN' : 'MANUFACTURER_STAFF';
    return { id: row.id, name: row.fullName ?? row.name ?? '', email: row.email, jobTitle: row.jobTitle ?? '', accessRole,
      warehouseId, warehouseName: this.warehouseService.findById(warehouseId ?? '')?.name ?? 'Unassigned', status: row.status ?? 'PENDING',
      lastActive: row.lastActiveAt ?? (row.status === 'PENDING' ? 'Invite pending' : '—'), category: 'EMPLOYEE' };
  }

  private deduplicateEmployees(members: ManufacturerStaffMember[]): ManufacturerStaffMember[] {
    const byEmail = new Map<string, ManufacturerStaffMember>();
    for (const member of members) {
      const key = member.email.trim().toLowerCase() || member.id;
      const previous = byEmail.get(key);
      if (!previous || this.memberPriority(member) > this.memberPriority(previous)) byEmail.set(key, member);
    }
    return [...byEmail.values()];
  }

  private memberPriority(member: ManufacturerStaffMember): number {
    const currentEmail = this.auth.user()?.email.trim().toLowerCase();
    return (member.email.trim().toLowerCase() === currentEmail ? 4 : 0)
      + (member.status === 'ACTIVE' ? 2 : member.status === 'SUSPENDED' ? 1 : 0);
  }

  inviteEmployee(employee: NewManufacturerEmployee) {
    return this.http.post<ApiMember>(API_ENDPOINTS.manufacturer.memberInvitations, {
      fullName: employee.name.trim(), email: employee.email.trim().toLowerCase(), jobTitle: employee.jobTitle, warehouseId: employee.warehouseId
    }).pipe(map(row => {
      if (this.isDriver(row)) throw new Error('Drivers are managed in the driver directory.');
      const warehouse = this.warehouseService.findById(row.warehouseId ?? employee.warehouseId);
      return { id: row.id, name: row.fullName ?? row.name ?? employee.name, email: row.email, jobTitle: row.jobTitle ?? employee.jobTitle,
        accessRole: 'MANUFACTURER_STAFF' as const, warehouseId: row.warehouseId ?? employee.warehouseId, warehouseName: warehouse?.name ?? 'Unassigned',
        status: row.status ?? 'PENDING', lastActive: 'Invite sent', category: 'EMPLOYEE' as const };
    }), tap(member => this.employeeRecords.update(records => this.deduplicateEmployees([member, ...records]))));
  }

  updateEmployeeStatus(id: string, status: StaffStatus) {
    return this.http.patch(API_ENDPOINTS.manufacturer.memberStatus(id), { status }).pipe(tap(() => this.refreshEmployees()));
  }
}
