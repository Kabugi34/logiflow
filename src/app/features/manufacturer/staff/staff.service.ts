import { computed, inject, Injectable, signal } from '@angular/core';
import { ManufacturerFleetService } from '../fleet/fleet.service';
import { ManufacturerWarehouseService } from '../warehouses/warehouse.service';
import { DriverAccountStatus } from '../fleet/fleet.models';
import { ManufacturerStaffMember, NewManufacturerEmployee, StaffStatus } from './staff.models';

const initialEmployees: ManufacturerStaffMember[] = [];

@Injectable({ providedIn: 'root' })
export class ManufacturerStaffService {
  private readonly fleetService = inject(ManufacturerFleetService);
  private readonly warehouseService = inject(ManufacturerWarehouseService);
  private readonly employeeRecords = signal(initialEmployees);

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

  inviteEmployee(employee: NewManufacturerEmployee): void {
    const normalizedEmail = employee.email.trim().toLowerCase();
    if (this.members().some(member => member.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An employee with this email is already in the directory.');
    }
    const warehouse = this.warehouseService.findById(employee.warehouseId);
    if (!warehouse) throw new Error('Select a valid warehouse.');
    this.employeeRecords.update(records => [...records, {
      id: `EMP-${String(records.length + 1).padStart(3, '0')}`,
      name: employee.name.trim(),
      email: normalizedEmail,
      jobTitle: employee.jobTitle,
      accessRole: 'MANUFACTURER_STAFF',
      warehouseId: warehouse.id,
      warehouseName: `${warehouse.city} Distribution Hub`,
      status: 'PENDING',
      lastActive: 'Invite sent',
      category: 'EMPLOYEE'
    }]);
  }

  updateEmployeeStatus(id: string, status: StaffStatus): void {
    const member = this.employeeRecords().find(record => record.id === id);
    if (!member || member.accessRole === 'MANUFACTURER_ADMIN') return;
    this.employeeRecords.update(records => records.map(record => record.id === id ? { ...record, status, lastActive: status === 'ACTIVE' ? 'Just now' : record.lastActive } : record));
  }

  updateDriverStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): boolean {
    const driver = this.fleetService.findDriver(id);
    if (!driver) return false;
    const action = status === 'SUSPENDED' ? 'SUSPEND' : driver.accountStatus === 'SUSPENDED' ? 'REACTIVATE' : 'APPROVE';
    return this.fleetService.transitionDriverAccount(id, action);
  }
}
