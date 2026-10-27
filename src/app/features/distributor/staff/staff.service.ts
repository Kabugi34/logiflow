import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { DistributorStaffMember, DistributorStaffStatus } from './staff.models';
import { DistributorFleetService } from '../fleet/fleet.service';
import { DriverAccountStatus } from '../fleet/fleet.models';
import { DistributorCatalogService } from '../catalog/catalog.service';
interface ApiMember { id: string; fullName?: string; name?: string; email: string; status?: DistributorStaffStatus; createdAt?: string; lastActiveAt?: string; }
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class DistributorStaffService {
  private readonly http = inject(HttpClient);
  private readonly fleet = inject(DistributorFleetService);
  private readonly catalog = inject(DistributorCatalogService);
  private readonly records = signal<DistributorStaffMember[]>([]);
  constructor() { this.refresh(); }

  refresh(): void {
    this.http.get<ApiPage<ApiMember> | ApiMember[]>(`${API_ENDPOINTS.distributor.members}?size=100`).subscribe({
      next: result => this.records.set((Array.isArray(result) ? result : result.content ?? []).map(row => ({
        id: row.id, name: row.fullName ?? row.name ?? '', email: row.email, role: 'DISTRIBUTOR_STAFF', status: row.status ?? 'PENDING',
        joinedAt: row.createdAt ?? '', jobTitle: 'Team Member', accessRole: 'Distributor Staff', warehouseName: 'Unassigned', category: 'EMPLOYEE',
        lastActive: row.lastActiveAt ?? (row.status === 'PENDING' ? 'Invite pending' : '—')
      }))),
      error: () => undefined
    });
  }
  readonly members = computed<DistributorStaffMember[]>(() => [
    ...this.records().map((member) => ({
      ...member,
      jobTitle: 'Team Member',
      accessRole: 'Distributor Staff',
      warehouseName: 'Unassigned',
      category: 'EMPLOYEE' as const,
      lastActive: member.status === 'PENDING' ? 'Invite pending' : '—',
    })),
    ...this.fleet.drivers().map((driver) => {
      const warehouseName = this.catalog.warehouses().find((warehouse) => warehouse.id === driver.baseWarehouseId)?.name ?? 'Unassigned';
      return {
        id: driver.id,
        driverId: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        license: driver.license,
        role: 'DRIVER' as const,
        status: driver.accountStatus as DriverAccountStatus,
        joinedAt: driver.createdAt,
        jobTitle: 'Driver',
        accessRole: 'Distributor Staff',
        warehouseName,
        category: 'DRIVER' as const,
        lastActive: driver.currentOrderId ? 'Just now' : driver.accountStatus === 'INVITED' ? 'Invite pending' : '—',
      };
    }),
  ]);

  invite(details: { name: string; email: string }): Observable<DistributorStaffMember> {
    return this.http.post<{ id: string; fullName?: string; name?: string; email: string; status?: DistributorStaffStatus; createdAt?: string }>(API_ENDPOINTS.distributor.memberInvitations, {
      fullName: details.name.trim(), email: details.email.trim().toLowerCase()
    }).pipe(map(row => ({ id: row.id, name: row.fullName ?? row.name ?? details.name, email: row.email,
      role: 'DISTRIBUTOR_STAFF' as const, status: row.status ?? 'INVITED', joinedAt: row.createdAt ?? '', jobTitle: 'Team Member',
      accessRole: 'Distributor Staff', warehouseName: 'Unassigned', category: 'EMPLOYEE' as const, lastActive: 'Invite pending' })), tap(member => this.records.update(rows => [member, ...rows])));
  }

  updateStatus(id: string, status: DistributorStaffStatus): Observable<unknown> {
    return this.http.patch(API_ENDPOINTS.distributor.memberStatus(id), { status }).pipe(tap(() => this.refresh()));
  }
}
