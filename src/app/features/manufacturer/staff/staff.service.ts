import { computed, inject, Injectable, signal } from '@angular/core';
import { ManufacturerFleetService } from '../fleet/fleet.service';
import { ManufacturerWarehouseService } from '../warehouses/warehouse.service';
import { DriverStatus } from '../fleet/fleet.models';
import { ManufacturerStaffMember, NewManufacturerEmployee, StaffStatus } from './staff.models';

const initialEmployees: ManufacturerStaffMember[] = [
  { id: 'EMP-001', name: 'Joseph Mwangi', email: 'j.mwangi@logiflow.io', jobTitle: 'Global Operations Manager', accessRole: 'MANUFACTURER_ADMIN', warehouseId: 'NBO-A1', warehouseName: 'Nairobi Central Hub', status: 'ACTIVE', lastActive: 'Just now', category: 'EMPLOYEE' },
  { id: 'EMP-002', name: 'Amina Hassan', email: 'a.hassan@logiflow.io', jobTitle: 'Warehouse Supervisor', accessRole: 'MANUFACTURER_STAFF', warehouseId: 'MBA-C4', warehouseName: 'Mombasa Freight Depot', status: 'ACTIVE', lastActive: '14 mins ago', category: 'EMPLOYEE' },
  { id: 'EMP-003', name: 'Brian Kiptoo', email: 'b.kiptoo@logiflow.io', jobTitle: 'Logistics Coordinator', accessRole: 'MANUFACTURER_STAFF', warehouseId: 'NBO-A1', warehouseName: 'Nairobi Central Hub', status: 'PENDING', lastActive: 'Invited 2h ago', category: 'EMPLOYEE' },
  { id: 'EMP-004', name: 'Mary Wanjiku', email: 'm.wanjiku@logiflow.io', jobTitle: 'Inventory Analyst', accessRole: 'MANUFACTURER_STAFF', warehouseId: 'NBO-A1', warehouseName: 'Nairobi Central Hub', status: 'ACTIVE', lastActive: '1 day ago', category: 'EMPLOYEE' },
  { id: 'EMP-005', name: 'Peter Ochieng', email: 'p.ochieng@logiflow.io', jobTitle: 'Gate Dispatch Controller', accessRole: 'MANUFACTURER_STAFF', warehouseId: 'MBA-C4', warehouseName: 'Mombasa Freight Depot', status: 'SUSPENDED', lastActive: 'Sep 20, 2024', category: 'EMPLOYEE' }
];

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
        email: `${emailName}@logiflow.io`,
        jobTitle: 'Driver',
        accessRole: 'MANUFACTURER_STAFF' as const,
        warehouseId,
        warehouseName: warehouse?.name ?? 'Unassigned',
        status: driver.status === 'INVITED'
          ? 'PENDING' as const
          : driver.status === 'SUSPENDED' ? 'SUSPENDED' as const : 'ACTIVE' as const,
        lastActive: driver.currentTripId ? 'Just now' : driver.status === 'INVITED' ? 'Invite sent' : '1 hour ago',
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

  updateDriverStatus(id: string, status: DriverStatus): boolean {
    return this.fleetService.updateDriverStatus(id, status);
  }
}
