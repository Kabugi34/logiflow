import { OrganizationType } from './organization.model';
import { UserRole } from './role.model';

export interface User {
  id: string | number;
  name: string;
  email: string;
  roles: UserRole[];
  organization: {
    id: string | number;
    name: string;
    type: OrganizationType;
  };
}
