import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FleetDriver,
  DriverAccountStatus,
  DriverOperationalStatus,
} from '../../fleet/fleet.models';
import { ManufacturerFleetService } from '../../fleet/fleet.service';
import { ManufacturerWarehouseService } from '../../warehouses/warehouse.service';
import {
  internationalPhone,
  licenceValue,
  personName,
  trimmedRequired,
} from '../../../../core/forms/form-validators';
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
  private warehouseService = inject(ManufacturerWarehouseService);
  protected warehouses = this.warehouseService.warehouses;
  protected drivers = this.fleet.drivers;
  protected search = signal('');
  protected filter = signal<DriverAccountStatus | 'ALL'>('ALL');
  protected notice = signal('');
  protected showForm = signal(false);
  protected selected = signal('');
  protected confirm = signal<{ driver: FleetDriver; action: Action } | null>(null);
  protected form = this.fb.nonNullable.group({
    name: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
    email: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
    phone: ['', [trimmedRequired, internationalPhone, Validators.maxLength(32)]],
    license: ['', [trimmedRequired, licenceValue, Validators.maxLength(40)]],
    baseWarehouseId: [''],
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      const id = this.fleet.onboardDriver(this.form.getRawValue());
      this.selected.set(id);
      this.showForm.set(false);
      this.notice.set('Driver added as Invited.');
    } catch (e) {
      this.notice.set(e instanceof Error ? e.message : 'Unable to save driver');
    }
  }
  protected ask(driver: FleetDriver, action: Action) {
    this.confirm.set({ driver, action });
  }
  protected act() {
    const c = this.confirm();
    if (!c) return;
    const ok = this.fleet.transitionDriverAccount(c.driver.id, c.action);
    this.notice.set(
      ok
        ? `${c.action.toLowerCase()} completed.`
        : 'This action is unavailable for the current status.',
    );
    if (['REJECT', 'REVOKE'].includes(c.action)) this.selected.set('');
    this.confirm.set(null);
  }
  protected availability(driver: FleetDriver, e: Event) {
    this.fleet.updateDriverOperationalStatus(
      driver.id,
      (e.target as HTMLSelectElement).value as DriverOperationalStatus,
    );
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


