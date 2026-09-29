export interface WarehouseStaffMember {
  name: string;
  role: string;
}

export interface WarehouseActivity {
  id: number;
  title: string;
  detail: string;
  timestamp: string;
  type: 'DRIVER' | 'FLEET' | 'AUDIT';
}

export interface ManufacturerWarehouse {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  status: 'ACTIVE' | 'INACTIVE';
  stockUnits: number;
  staffCount: number;
  siteManager: string;
  managerRole: string;
  activities: WarehouseActivity[];
  staff: WarehouseStaffMember[];
}
