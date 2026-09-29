export type StaffAccessRole = 'MANUFACTURER_ADMIN' | 'MANUFACTURER_STAFF';
export type StaffStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED';
export type StaffCategory = 'EMPLOYEE' | 'DRIVER';

export interface ManufacturerStaffMember {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  accessRole: StaffAccessRole;
  warehouseId: string | null;
  warehouseName: string;
  status: StaffStatus;
  lastActive: string;
  category: StaffCategory;
}

export interface NewManufacturerEmployee {
  name: string;
  email: string;
  jobTitle: string;
  warehouseId: string;
}
