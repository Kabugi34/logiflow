import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FleetDriver,
  DriverAccountStatus,
  DriverOperationalStatus,
} from '../../fleet/fleet.models';
import { ManufacturerFleetService } from '../../fleet/fleet.service';
import {
  internationalPhone,
  licenceValue,
  personName,
  trimmedRequired,
} from '../../../../core/forms/form-validators';
import { finalize } from 'rxjs';
type Action = 'APPROVE' | 'REJECT' | 'RESEND' | 'REVOKE' | 'SUSPEND' | 'REACTIVATE';
@Component({
  selector: 'app-driver-directory',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule],
  templateUrl: './driver-directory.component.html',
})
export class DriverDirectoryComponent {
  private fleet = inject(ManufacturerFleetService);
  private fb = inject(FormBuilder);
  protected drivers = this.fleet.drivers;
  protected search = signal('');
  protected filter = signal<DriverAccountStatus | 'ALL'>('ALL');
  protected notice = signal('');
  protected saving = signal(false);
  protected showForm = signal(false);
  protected selected = signal('');
  protected confirm = signal<{ driver: FleetDriver; action: Action } | null>(null);
  protected form = this.fb.nonNullable.group({
    name: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
    email: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
    phone: ['', [trimmedRequired, internationalPhone, Validators.maxLength(32)]],
    license: ['', [trimmedRequired, licenceValue, Validators.maxLength(40)]],
  });
  protected fieldError(field: 'name' | 'email' | 'phone' | 'license') {
    const c = this.form.controls[field];
    if (!c.touched || c.valid) return '';
    if (c.hasError('required')) return 'This field is required.';
    if (c.hasError('email')) return 'Enter a valid email address.';
    if (c.hasError('internationalPhone'))
      return 'Enter an international number with country code, e.g. +254712345678.';
    if (c.hasError('personName')) return 'Use letters, spaces, apostrophes, periods, or hyphens.';
    if (c.hasError('licenceValue'))
      return 'Use 2–40 letters, numbers, spaces, slashes, or hyphens.';
    if (c.hasError('maxlength'))
      return `Maximum length is ${c.getError('maxlength').requiredLength} characters.`;
    return 'Check this value.';
  }
  protected rows = computed(() =>
    this.drivers().filter(
      (d) =>
        (this.filter() === 'ALL' || d.accountStatus === this.filter()) &&
        (!this.search() ||
          [d.name, d.email, d.phone, d.license].some((v) =>
            v.toLowerCase().includes(this.search().toLowerCase()),
          )),
    ),
  );
  protected updateSearch(e: Event) {
    this.search.set((e.target as HTMLInputElement).value);
  }
  protected updateFilter(e: Event) {
    this.filter.set((e.target as HTMLSelectElement).value as DriverAccountStatus | 'ALL');
  }
  protected add() {
    this.form.reset();
    this.showForm.set(true);
  }
  protected save() {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.fleet.createDriverApi(this.form.getRawValue()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: invitation => {
        this.selected.set('');
        this.showForm.set(false);
        this.notice.set(`Invitation ${invitation.id} was created. Email delivery is not confirmed; check the refreshed driver list for status.`);
      },
      error: error => this.notice.set(error?.status === 403
        ? 'Your organization is not currently permitted to create driver invitations. No driver record was created; contact an administrator.'
        : error?.error?.message ?? 'Could not confirm invitation creation. Check the refreshed driver list before trying again.')
    });
  }
  protected ask(driver: FleetDriver, action: Action) {
    this.confirm.set({ driver, action });
  }
  protected act() {
    const c = this.confirm();
    if (!c) return;
    if (this.saving()) return;
    this.saving.set(true);
    this.fleet.driverActionApi(c.driver.id, c.action).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.notice.set(`${c.action.toLowerCase()} completed.`); if (['REJECT', 'REVOKE'].includes(c.action)) this.selected.set(''); this.confirm.set(null); },
      error: error => { this.notice.set(error?.error?.message ?? 'Driver action could not be completed.'); this.confirm.set(null); }
    });
  }
  protected availability(driver: FleetDriver, e: Event) {
    const status = (e.target as HTMLSelectElement).value as DriverOperationalStatus;
    if (status === 'ON_TRIP') return;
    this.fleet.setOperationalStatusApi(driver.id, status).subscribe({
      error: error => this.notice.set(error?.error?.message ?? 'Availability could not be updated.')
    });
  }
  protected label(s: DriverAccountStatus) {
    return {
      INVITED: 'Invited',
      PENDING_APPROVAL: 'Pending Approval',
      ACTIVE: 'Active',
      SUSPENDED: 'Suspended',
      INVITATION_EXPIRED: 'Invitation Expired',
    }[s];
  }
  protected actionName(s: Action) {
    return {
      APPROVE: 'Approve',
      REJECT: 'Reject',
      RESEND: 'Resend invitation',
      REVOKE: 'Revoke invitation',
      SUSPEND: 'Suspend',
      REACTIVATE: 'Reactivate',
    }[s];
  }
}
