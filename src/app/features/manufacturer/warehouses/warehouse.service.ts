import { Injectable, signal } from '@angular/core';
import { ManufacturerWarehouse } from './warehouse.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerWarehouseService {
  private readonly warehouseRecords = signal<ManufacturerWarehouse[]>([
    {
      id: 'NBO-A1',
      name: 'Nairobi Distribution Hub A-1',
      address: 'Mombasa Road, Industrial Area',
      city: 'Nairobi',
      postalCode: '00100',
      status: 'ACTIVE',
      stockUnits: 14892,
      staffCount: 24,
      siteManager: 'Joseph Mwangi',
      managerRole: 'Site Manager (SSO Auth Active)',
      activities: [
        { id: 1, title: 'Daniel Kamau (Isuzu FVR)', detail: 'Loading Gate 4 · PO-2026-094', timestamp: '10 min ago', type: 'DRIVER' },
        { id: 2, title: 'Fleet Carrier KDA 123A (Isuzu)', detail: 'Arrived Nairobi Yard · Hold Manifest Audit', timestamp: '28 min ago', type: 'FLEET' },
        { id: 3, title: 'Driver Daniel Kamau', detail: 'Checked in Nairobi Gate 4 · Audit Sync Success', timestamp: '1 hr ago', type: 'AUDIT' }
      ],
      staff: [
        { name: 'Peter Otieno', role: 'Yardmaster' },
        { name: 'Joseph Mwangi', role: 'Site Manager' },
        { name: 'Daniel Kamau', role: 'Driver' },
        { name: 'Faith Njeri', role: 'Driver' }
      ]
    },
    {
      id: 'MBA-C4',
      name: 'Mombasa Freight Terminal C-4',
      address: 'Shimanzi Road, Port Reitz',
      city: 'Mombasa',
      postalCode: '80100',
      status: 'ACTIVE',
      stockUnits: 8120,
      staffCount: 12,
      siteManager: 'Amina Hassan',
      managerRole: 'Site Manager (SSO Auth Active)',
      activities: [
        { id: 4, title: 'Receiving inspection', detail: 'Hydraulic Motors · Dock 2', timestamp: '18 min ago', type: 'AUDIT' },
        { id: 5, title: 'Fleet Carrier #11-C', detail: 'Outbound manifest verified', timestamp: '46 min ago', type: 'FLEET' }
      ],
      staff: [
        { name: 'Amina Hassan', role: 'Site Manager' },
        { name: 'Brian Kiptoo', role: 'Yardmaster' },
        { name: 'Grace Wambui', role: 'Driver' }
      ]
    }
  ]);

  readonly warehouses = this.warehouseRecords.asReadonly();

  findById(id: string): ManufacturerWarehouse | undefined {
    return this.warehouseRecords().find(warehouse => warehouse.id === id);
  }
}
