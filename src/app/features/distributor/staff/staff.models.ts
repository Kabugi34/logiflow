export type DistributorStaffStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'INVITED'
  | 'PENDING_APPROVAL'
  | 'INVITATION_EXPIRED';
export interface DistributorStaffMember {
  id: string;
  name: string;
  email: string;
  role: 'DISTRIBUTOR_STAFF' | 'DRIVER';
  status: DistributorStaffStatus;
  joinedAt: string;
  driverId?: string;
  phone?: string;
  license?: string;
  jobTitle: string;
  accessRole: string;
  warehouseName: string;
  category: 'EMPLOYEE' | 'DRIVER';
  lastActive: string;
}
