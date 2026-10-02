import { Injectable, signal } from '@angular/core';
import { OrganizationType } from '../models/organization.model';
import { UserRole } from '../models/role.model';
import { User } from '../models/user.model';

export interface AccessRequest {
  id: string;
  organizationType: OrganizationType;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  organizationEmail: string;
  phoneNumber: string;
  activationToken: string | null;
  createdAt: string;
  status: 'PENDING' | 'INVITED' | 'ACTIVATED';
}

interface StoredAccount {
  id: number;
  email: string;
  password: string;
  name: string;
  roles: UserRole[];
  organization: {
    id: number;
    name: string;
    type: OrganizationType;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly currentUser = signal<User | null>(this.readStoredUser());
  private readonly storageKey = 'logiflow.currentUser';
  private readonly accountsKey = 'logiflow.accounts';
  private readonly requestsKey = 'logiflow.accessRequests';

  readonly user = this.currentUser.asReadonly();

  constructor() {
    this.seedDemoAccounts();
  }

  setUser(user: User): void {
    this.currentUser.set(user);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.storageKey, JSON.stringify(user));
    }
  }

  clearUser(): void {
    this.currentUser.set(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.storageKey);
    }
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.includes(role as UserRole) ?? false;
  }

  requestAccess(payload: Omit<AccessRequest, 'id' | 'activationToken' | 'createdAt' | 'status'>): AccessRequest {
    const request: AccessRequest = {
      ...payload,
      id: `REQ-${Date.now()}`,
      activationToken: null,
      createdAt: new Date().toISOString(),
      status: 'PENDING'
    };

    const requests = this.readAccessRequests().filter((item) =>
      item.status !== 'PENDING' ||
      item.contactEmail.toLowerCase() !== request.contactEmail.toLowerCase() ||
      item.organizationEmail.toLowerCase() !== request.organizationEmail.toLowerCase()
    );
    this.writeAccessRequests([...requests, request]);

    return request;
  }

  activateAccount(payload: {
    email: string;
    activationToken: string;
    password: string;
    confirmPassword: string;
  }): User {
    const request = this.readAccessRequests().find((item) =>
      item.contactEmail.toLowerCase() === payload.email.toLowerCase() &&
      item.status === 'INVITED' &&
      item.activationToken === payload.activationToken
    );

    if (!request) {
      throw new Error('This activation link is invalid, expired, or has already been used.');
    }

    if (payload.password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    if (payload.password !== payload.confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    const account: StoredAccount = {
      id: Date.now(),
      email: request.contactEmail,
      password: payload.password,
      name: request.contactName,
      roles: request.organizationType === 'MANUFACTURER'
        ? ['MANUFACTURER_ADMIN']
        : ['DISTRIBUTOR_ADMIN'],
      organization: {
        id: Date.now() + 1,
        name: request.organizationName,
        type: request.organizationType
      }
    };

    const accounts = this.readAccounts();
    const accountIndex = accounts.findIndex((item) => item.email.toLowerCase() === account.email.toLowerCase());

    if (accountIndex >= 0) {
      accounts[accountIndex] = account;
    } else {
      accounts.push(account);
    }

    this.writeAccounts(accounts);

    const updatedRequests: AccessRequest[] = this.readAccessRequests().map((item) =>
      item.id === request.id
        ? { ...item, status: 'ACTIVATED' }
        : item
    );

    this.writeAccessRequests(updatedRequests);

    const user: User = {
      id: account.id,
      name: account.name,
      email: account.email,
      roles: account.roles,
      organization: account.organization
    };

    return user;
  }

  login(email: string, password: string): User | null {
    const normalizedEmail = email.trim().toLowerCase();
    const account = this.readAccounts().find((item) =>
      item.email.toLowerCase() === normalizedEmail && item.password === password
    );

    if (!account) {
      return null;
    }

    const user: User = {
      id: account.id,
      name: account.name,
      email: account.email,
      roles: account.roles,
      organization: account.organization
    };

    this.setUser(user);
    return user;
  }

  private seedDemoAccounts(): void {
    const accounts = this.readAccounts();

    if (accounts.length > 0) {
      return;
    }

    this.writeAccounts([
      {
        id: 1001,
        email: 'manufacturer@demo.logiflow',
        password: 'Logiflow123!',
        name: 'Manufacturer Admin',
        roles: ['MANUFACTURER_ADMIN'],
        organization: {
          id: 2001,
          name: 'Northstar Manufacturing',
          type: 'MANUFACTURER'
        }
      },
      {
        id: 1002,
        email: 'distributor@demo.logiflow',
        password: 'Logiflow123!',
        name: 'Distributor Admin',
        roles: ['DISTRIBUTOR_ADMIN'],
        organization: {
          id: 2002,
          name: 'Apex Distribution',
          type: 'DISTRIBUTOR'
        }
      }
    ]);
  }

  private readStoredUser(): User | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawUser = window.localStorage.getItem(this.storageKey);
    return rawUser ? JSON.parse(rawUser) as User : null;
  }

  private readAccounts(): StoredAccount[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const rawAccounts = window.localStorage.getItem(this.accountsKey);
    return rawAccounts ? JSON.parse(rawAccounts) as StoredAccount[] : [];
  }

  private writeAccounts(accounts: StoredAccount[]): void {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.accountsKey, JSON.stringify(accounts));
    }
  }

  private readAccessRequests(): AccessRequest[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const rawRequests = window.localStorage.getItem(this.requestsKey);
    return rawRequests ? JSON.parse(rawRequests) as AccessRequest[] : [];
  }

  private writeAccessRequests(requests: AccessRequest[]): void {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.requestsKey, JSON.stringify(requests));
    }
  }
}