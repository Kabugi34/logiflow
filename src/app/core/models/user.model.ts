import { OrganizationType } from './organization.model';
import { UserRole } from './role.model';

export interface User {
  id: number;
  name: string;
  email: string;
  roles: UserRole[];
  organization: {
    id: number;
    name: string;
    type: OrganizationType;
  };
}