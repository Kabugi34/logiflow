import { computed, inject, Injectable, signal } from '@angular/core';
import { ManufacturerFleetService } from '../fleet/fleet.service';
import { ManufacturerWarehouseService } from '../warehouses/warehouse.service';
import { ManufacturerStaffMember, NewManufacturerEmployee, StaffStatus } from './staff.models';

const initialEmployees: ManufacturerStaffMember[] = [
  { id: 'EMP-001', name: 'Marcus Vance', email: 'm.vance@logiflow.io', jobTitle: 'Global Operations Manager', accessRole: 'MANUFACTURER_ADMIN', warehouseId: 'CHI-A1', warehouseName: 'Chicago Central Hub', status: 'ACTIVE', lastActive: 'Just now', category: 'EMPLOYEE' },
  { id: 'EMP-002', name: 'Lana Rhoades', email: 'l.rhoades@logiflow.io', jobTitle: 'Warehouse Supervisor', accessRole: 'MANUFACTURER_STAFF', warehouseId: 'HOU-C4', warehouseName: 'Houston Depot', status: 'ACTIVE', lastActive: '14 mins ago', category: 'EMPLOYEE' },
  { id: 'EMP-003', name: 'Viktor Reznov', email: 'v.reznov@logiflow.io', jobTitle: 'Logistics Coordinator', accessRole: 'MANUFACTURER_STAFF', warehouseId: 'CHI-A1', warehouseName: 'Chicago Central Hub', status: 'PENDING', lastActive: 'Invited 2h ago', category: 'EMPLOYEE' },
  { id: 'EMP-004', name: 'Selene Meyer', email: 's.meyer@logiflow.io', jobTitle: 'Inventory Analyst', accessRole: 'MANUFACTURER_STAFF', warehouseId: 'CHI-A1', warehouseName: 'Chicago Central Hub', status: 'ACTIVE', lastActive: '1 day ago', category: 'EMPLOYEE' },
  { id: 'EMP-005', name: 'Arthur Dent', email: 'a.dent@logiflow.io', jobTitle: 'Gate Dispatch Controller', accessRole: 'MANUFACTURER_STAFF', warehouseId: 'HOU-C4', warehouseName: 'Houston Depot', status: 'SUSPENDED', lastActive: 'Sep 20, 2024', category: 'EMPLOYEE' }
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
      const warehouseId = driver.routeZone.includes('West') ? 'HOU-C4' : 'CHI-A1';
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
        status: driver.status === 'INVITED' ? 'PENDING' as const : 'ACTIVE' as const,
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
      warehouseName: `${warehouse.city} ${warehouse.id === 'CHI-A1' ? 'Central Hub' : 'Depot'}`,
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
}
