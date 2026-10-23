import { Injectable, signal } from '@angular/core';
import { DistributorStaffMember, DistributorStaffStatus } from './staff.models';

@Injectable({ providedIn: 'root' })
export class DistributorStaffService {
  private readonly records = signal<DistributorStaffMember[]>([]);
  readonly members = this.records.asReadonly();

  invite(details: { name: string; email: string }): DistributorStaffMember {
    const email = details.email.trim().toLowerCase();
    if (this.records().some((row) => row.email === email))
      throw new Error('This email is already in the staff directory.');
    const member: DistributorStaffMember = {
      id: `staff-${Date.now()}`,
      name: details.name.trim(),
      email,
      role: 'DISTRIBUTOR_STAFF',
      status: 'PENDING',
      joinedAt: new Date().toISOString(),
    };
    this.records.update((rows) => [...rows, member]);
    return member;
  }

  updateStatus(id: string, status: DistributorStaffStatus): boolean {
    if (!this.records().some((member) => member.id === id)) return false;
    this.records.update((rows) =>
      rows.map((member) => (member.id === id ? { ...member, status } : member)),
    );
    return true;
  }
}
