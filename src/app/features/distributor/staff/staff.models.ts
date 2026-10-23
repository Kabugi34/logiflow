export type DistributorStaffStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export interface DistributorStaffMember {
  id: string;
  name: string;
  email: string;
  role: 'DISTRIBUTOR_STAFF';
  status: DistributorStaffStatus;
  joinedAt: string;
}
