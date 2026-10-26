import { computed, inject, Injectable, signal } from '@angular/core';
import { DistributorStaffMember, DistributorStaffStatus } from './staff.models';
import { DistributorFleetService } from '../fleet/fleet.service';
import { DriverAccountStatus } from '../fleet/fleet.models';
import { DistributorCatalogService } from '../catalog/catalog.service';

@Injectable({ providedIn: 'root' })
export class DistributorStaffService {
  private readonly fleet = inject(DistributorFleetService);
  private readonly catalog = inject(DistributorCatalogService);
  private readonly records = signal<DistributorStaffMember[]>([]);
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

  invite(details: { name: string; email: string }): DistributorStaffMember {
    const email = details.email.trim().toLowerCase();
    if (this.records().some((row) => row.email === email))
      throw new Error('This email is already in the staff directory.');
    const member: DistributorStaffMember = {
      id: `staff-${Date.now()}`,
      name: details.name.trim(),
      email,
      role: 'DISTRIBUTOR_STAFF',
      status: 'PENDING',
      joinedAt: new Date().toISOString(),
      jobTitle: 'Team Member',
      accessRole: 'Distributor Staff',
      warehouseName: 'Unassigned',
      category: 'EMPLOYEE',
      lastActive: 'Invite pending',
    };
    this.records.update((rows) => [...rows, member]);
    return member;
  }

  updateStatus(id: string, status: DistributorStaffStatus): boolean {
    if (!this.records().some((member) => member.id === id)) return false;
    this.records.update((rows) =>
      rows.map((member) => (member.id === id ? { ...member, status } : member)),
    );
    return true;
  }
}
