import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DistributorDriver,
  DriverAccountStatus,
  DriverOperationalStatus,
} from '../../fleet/fleet.models';
import { DistributorFleetService } from '../../fleet/fleet.service';
import { DistributorCatalogService } from '../../catalog/catalog.service';
import {
  internationalPhone,
  licenceValue,
  personName,
  trimmedRequired,
} from '../../../../core/forms/form-validators';

type DriverAction = 'APPROVE' | 'REJECT' | 'RESEND' | 'REVOKE' | 'SUSPEND' | 'REACTIVATE';
@Component({
  selector: 'app-distributor-driver-directory',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule],
  templateUrl: './driver-directory.component.html',
})
export class DriverDirectoryComponent {
  private readonly fleet = inject(DistributorFleetService);
  private readonly catalog = inject(DistributorCatalogService);
  private readonly fb = inject(FormBuilder);
  protected readonly drivers = this.fleet.drivers;
  protected readonly warehouses = this.catalog.warehouses;
  protected readonly query = signal('');
  protected readonly statusFilter = signal<DriverAccountStatus | 'ALL'>('ALL');
  protected readonly selectedId = signal('');
  protected readonly selectedDriver = computed(() => this.fleet.findDriver(this.selectedId()));
  protected readonly dialogOpen = signal(false);
  protected readonly editingId = signal('');
  protected readonly formError = signal('');
  protected readonly notice = signal('');
  protected readonly confirmation = signal<{
    driver: DistributorDriver;
    action: DriverAction;
  } | null>(null);
  protected readonly counts = computed(() => ({
    total: this.drivers().length,
    invited: this.drivers().filter((d) => d.accountStatus === 'INVITED').length,
    pending: this.drivers().filter((d) => d.accountStatus === 'PENDING_APPROVAL').length,
    active: this.drivers().filter((d) => d.accountStatus === 'ACTIVE').length,
    suspended: this.drivers().filter((d) => d.accountStatus === 'SUSPENDED').length,
    expired: this.drivers().filter((d) => d.accountStatus === 'INVITATION_EXPIRED').length,
  }));
  protected readonly filteredDrivers = computed(() => {
    const q = this.query().trim().toLowerCase();
    const state = this.statusFilter();
    return this.drivers().filter(
      (d) =>
        (!q || [d.name, d.email, d.phone, d.license].some((v) => v.toLowerCase().includes(q))) &&
        (state === 'ALL' || d.accountStatus === state),
    );
  });
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
    email: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
    phone: ['', [trimmedRequired, internationalPhone, Validators.maxLength(32)]],
    license: ['', [trimmedRequired, licenceValue, Validators.maxLength(40)]],
    baseWarehouseId: [''],
  });

  protected fieldError(field: 'name' | 'email' | 'phone' | 'license'): string {
    const control = this.form.controls[field];
    if (!control.touched || control.valid) return '';
    if (control.hasError('required')) return 'This field is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('internationalPhone'))
      return 'Enter an international number with country code, e.g. +254712345678.';
    if (control.hasError('personName'))
      return 'Use letters, spaces, apostrophes, periods, or hyphens.';
    if (control.hasError('licenceValue'))
      return 'Use 2–40 letters, numbers, spaces, slashes, or hyphens.';
    if (control.hasError('maxlength'))
      return `Maximum length is ${control.getError('maxlength').requiredLength} characters.`;
    return 'Check this value.';
  }

  protected updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
  protected updateFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as DriverAccountStatus | 'ALL');
  }
  protected select(driver: DistributorDriver): void {
    this.selectedId.set(driver.id);
    this.notice.set('');
  }
  protected openOnboard(): void {
    this.editingId.set('');
    this.form.reset({ name: '', email: '', phone: '', license: '', baseWarehouseId: '' });
    this.formError.set('');
    this.dialogOpen.set(true);
  }
  protected edit(driver: DistributorDriver): void {
    if (driver.operationalStatus === 'ON_TRIP') {
      this.notice.set('Complete the active trip before editing this driver.');
      return;
    }
    this.editingId.set(driver.id);
    this.form.reset({
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      license: driver.license,
      baseWarehouseId: driver.baseWarehouseId ?? '',
    });
    this.formError.set('');
    this.dialogOpen.set(true);
  }
  protected closeDialog(): void {
    this.dialogOpen.set(false);
  }
  protected saveDriver(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      const value = this.form.getRawValue();
      if (this.editingId()) this.fleet.updateDriverProfile(this.editingId(), value);
      else {
        const driver = this.fleet.onboardDriver(value);
        this.selectedId.set(driver.id);
        this.statusFilter.set('ALL');
        this.query.set('');
        this.notice.set('Driver added with Invited account status.');
      }
      this.dialogOpen.set(false);
    } catch (error) {
      this.formError.set(error instanceof Error ? error.message : 'Unable to save driver details.');
    }
  }
  protected ask(driver: DistributorDriver, action: DriverAction): void {
    this.confirmation.set({ driver, action });
  }
  protected cancelConfirmation(): void {
    this.confirmation.set(null);
  }
  protected confirmAction(): void {
    const pending = this.confirmation();
    if (!pending) return;
    const ok = this.fleet.transitionDriverAccount(pending.driver.id, pending.action);
    const messages: Record<DriverAction, string> = {
      APPROVE: 'Driver approved and account activated.',
      REJECT: 'Pending application rejected and removed.',
      RESEND: 'Invitation resent.',
      REVOKE: 'Invitation revoked and removed.',
      SUSPEND: 'Driver access suspended.',
      REACTIVATE: 'Driver reactivated.',
    };
    this.notice.set(
      ok
        ? messages[pending.action]
        : 'The action is unavailable for this driver in its current state.',
    );
    if (pending.action === 'REJECT' || pending.action === 'REVOKE') this.selectedId.set('');
    this.confirmation.set(null);
  }
  protected updateOperationalStatus(driver: DistributorDriver, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as DriverOperationalStatus;
    this.notice.set(
      this.fleet.updateDriverOperationalStatus(driver.id, status)
        ? 'Operational availability updated.'
        : 'Operational status cannot be changed during an active trip.',
    );
  }
  protected warehouseName(id: string | null): string {
    return this.warehouses().find((w) => w.id === id)?.name ?? 'No base warehouse';
  }
  protected accountLabel(status: DriverAccountStatus): string {
    return {
      INVITED: 'Invited',
      PENDING_APPROVAL: 'Pending Approval',
      ACTIVE: 'Active',
      SUSPENDED: 'Suspended',
      INVITATION_EXPIRED: 'Invitation Expired',
    }[status];
  }
  protected accountClass(status: DriverAccountStatus): string {
    switch (status) {
      case 'INVITED':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'PENDING_APPROVAL':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'ACTIVE':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'SUSPENDED':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'INVITATION_EXPIRED':
        return 'border-slate-300 bg-slate-100 text-slate-600';
    }
  }
  protected actionTitle(action: DriverAction): string {
    return {
      APPROVE: 'Approve driver',
      REJECT: 'Reject application',
      RESEND: 'Resend invitation',
      REVOKE: 'Revoke invitation',
      SUSPEND: 'Suspend driver',
      REACTIVATE: 'Reactivate driver',
    }[action];
  }
  protected actionDescription(action: DriverAction, driver: DistributorDriver): string {
    return {
      APPROVE: `Approve ${driver.name}'s application and activate the account?`,
      REJECT: `Reject ${driver.name}'s application and remove the pending record?`,
      RESEND: `Send another invitation to ${driver.email}?`,
      REVOKE: `Revoke the invitation for ${driver.name} and remove the pending record?`,
      SUSPEND: `Suspend ${driver.name}'s account? They will no longer be eligible for dispatch.`,
      REACTIVATE: `Restore ${driver.name}'s account and make them available for dispatch?`,
    }[action];
  }
}
