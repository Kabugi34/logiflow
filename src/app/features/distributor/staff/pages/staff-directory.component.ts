import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DistributorStaffMember, DistributorStaffStatus } from '../staff.models';
import { DistributorStaffService } from '../staff.service';
import { personName, trimmedRequired } from '../../../../core/forms/form-validators';
import { DistributorFleetService } from '../../fleet/fleet.service';
import { DriverAccountStatus } from '../../fleet/fleet.models';

@Component({
  selector: 'app-distributor-staff-directory',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './staff-directory.component.html',
})
export class StaffDirectoryComponent {
  private readonly service = inject(DistributorStaffService);
  private readonly fleet = inject(DistributorFleetService);
  private readonly fb = inject(FormBuilder);
  protected readonly staff = this.service.members;
  protected readonly selectedCategory = signal<'ALL' | 'EMPLOYEE' | 'DRIVER'>('ALL');
  protected readonly selectedStatus = signal<'ALL' | DistributorStaffStatus>('ALL');
  protected readonly searchTerm = signal('');
  protected readonly selectedMemberId = signal<string | null>(null);
  protected readonly isInviteOpen = signal(false);
  protected readonly inviteError = signal('');
  protected readonly driverActionMessage = signal('');
  protected readonly selectedMember = computed(
    () => this.staff().find((member) => member.id === this.selectedMemberId()) ?? null,
  );
  protected readonly summary = computed(() => ({
    employees: this.staff().filter((member) => member.category === 'EMPLOYEE').length,
    drivers: this.staff().filter((member) => member.category === 'DRIVER').length,
  }));
  protected readonly filteredStaff = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.staff().filter((member) => {
      const matchesQuery = !query || [member.name, member.email, member.jobTitle, member.warehouseName]
        .some((value) => value.toLowerCase().includes(query));
      const matchesCategory = this.selectedCategory() === 'ALL' || member.category === this.selectedCategory();
      const matchesStatus = this.selectedStatus() === 'ALL' || member.status === this.selectedStatus();
      return matchesQuery && matchesCategory && matchesStatus;
    });
  });
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
    email: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
  });

  protected updateSearch(event: Event): void { this.searchTerm.set((event.target as HTMLInputElement).value); }
  protected updateCategory(event: Event): void { this.selectedCategory.set((event.target as HTMLSelectElement).value as 'ALL' | 'EMPLOYEE' | 'DRIVER'); }
  protected updateStatus(event: Event): void { this.selectedStatus.set((event.target as HTMLSelectElement).value as 'ALL' | DistributorStaffStatus); }
  protected openInvite(): void { this.form.reset({ name: '', email: '' }); this.inviteError.set(''); this.isInviteOpen.set(true); }
  protected closeInvite(): void { this.isInviteOpen.set(false); }
  protected sendInvitation(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    try {
      const member = this.service.invite(this.form.getRawValue());
      this.selectedCategory.set('ALL'); this.selectedStatus.set('ALL'); this.searchTerm.set('');
      this.selectedMemberId.set(member.id); this.isInviteOpen.set(false);
    } catch (error) {
      this.inviteError.set(error instanceof Error ? error.message : 'Unable to send this invitation.');
    }
  }
  protected manage(member: DistributorStaffMember): void {
    this.selectedMemberId.set(this.selectedMemberId() === member.id ? null : member.id);
    this.driverActionMessage.set('');
  }
  protected updateEmployeeStatus(event: Event): void {
    const member = this.selectedMember();
    if (!member || member.category !== 'EMPLOYEE') return;
    this.service.updateStatus(member.id, (event.target as HTMLSelectElement).value as DistributorStaffStatus);
  }
  protected driverAction(member: DistributorStaffMember, action: 'APPROVE' | 'REJECT' | 'RESEND' | 'REVOKE' | 'SUSPEND' | 'REACTIVATE'): void {
    if (!member.driverId) return;
    const ok = this.fleet.transitionDriverAccount(member.driverId, action);
    const messages: Record<typeof action, string> = {
      APPROVE: 'Driver approved and account activated.', REJECT: 'Driver application rejected.',
      RESEND: 'Driver invitation resent.', REVOKE: 'Driver invitation revoked.',
      SUSPEND: 'Driver access suspended.', REACTIVATE: 'Driver access reactivated.',
    };
    this.driverActionMessage.set(ok ? messages[action] : 'This action is unavailable for the driver’s current status.');
    if (action === 'REJECT' || action === 'REVOKE') this.selectedMemberId.set(null);
  }
  protected isDriverStatus(status: DistributorStaffStatus): status is DriverAccountStatus {
    return ['INVITED', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'INVITATION_EXPIRED'].includes(status);
  }
  protected statusClass(status: DistributorStaffStatus): string {
    if (status === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'SUSPENDED') return 'border-red-200 bg-red-50 text-red-700';
    if (status === 'PENDING' || status === 'PENDING_APPROVAL') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (status === 'INVITED') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    return 'border-slate-300 bg-slate-100 text-slate-600';
  }
  protected statusLabel(status: DistributorStaffStatus): string {
    return status === 'PENDING_APPROVAL' ? 'PENDING APPROVAL' : status === 'INVITATION_EXPIRED' ? 'INVITATION EXPIRED' : status;
  }
}
