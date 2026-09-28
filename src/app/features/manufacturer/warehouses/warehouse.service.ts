import { Injectable, signal } from '@angular/core';
import { ManufacturerWarehouse } from './warehouse.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerWarehouseService {
  private readonly warehouseRecords = signal<ManufacturerWarehouse[]>([
    {
      id: 'CHI-A1',
      name: 'Terminal Gate A-1 (Chicago)',
      address: '1450 Operational Logistics Blvd',
      city: 'Chicago',
      postalCode: 'IL 60601',
      status: 'ACTIVE',
      stockUnits: 14892,
      staffCount: 24,
      siteManager: 'Alex Harper',
      managerRole: 'Site Manager (SSO Auth Active)',
      activities: [
        { id: 1, title: 'Alex Mercer (Kenworth T680)', detail: 'Loading Gate 4 · PO-2026-094', timestamp: '10 min ago', type: 'DRIVER' },
        { id: 2, title: 'Fleet Carrier #04-B (Peterbilt)', detail: 'Arrived Chicago Yard · Hold Manifest Audit', timestamp: '28 min ago', type: 'FLEET' },
        { id: 3, title: 'Driver Alex Mercer', detail: 'Checked in Chicago Gate 4 · Audit Sync Success', timestamp: '1 hr ago', type: 'AUDIT' }
      ],
      staff: [
        { name: 'David Jenkins', role: 'Yardmaster' },
        { name: 'Alex Harper', role: 'Site Manager' },
        { name: 'Alex Mercer', role: 'Driver' },
        { name: 'Sarah Connor', role: 'Driver' }
      ]
    },
    {
      id: 'HOU-C4',
      name: 'Terminal Gate C-4 (Houston)',
      address: '800 Port Energy Parkway',
      city: 'Houston',
      postalCode: 'TX 77001',
      status: 'ACTIVE',
      stockUnits: 8120,
      staffCount: 12,
      siteManager: 'Jordan Ellis',
      managerRole: 'Site Manager (SSO Auth Active)',
      activities: [
        { id: 4, title: 'Receiving inspection', detail: 'Hydraulic Motors · Dock 2', timestamp: '18 min ago', type: 'AUDIT' },
        { id: 5, title: 'Fleet Carrier #11-C', detail: 'Outbound manifest verified', timestamp: '46 min ago', type: 'FLEET' }
      ],
      staff: [
        { name: 'Jordan Ellis', role: 'Site Manager' },
        { name: 'Morgan Price', role: 'Yardmaster' },
        { name: 'Taylor Reed', role: 'Driver' }
      ]
    }
  ]);

  readonly warehouses = this.warehouseRecords.asReadonly();

  findById(id: string): ManufacturerWarehouse | undefined {
    return this.warehouseRecords().find(warehouse => warehouse.id === id);
  }
}
