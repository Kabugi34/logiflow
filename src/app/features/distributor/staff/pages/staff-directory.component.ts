import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DistributorStaffMember, DistributorStaffStatus } from '../staff.models';
import { DistributorStaffService } from '../staff.service';
import { personName, trimmedRequired } from '../../../../core/forms/form-validators';

@Component({
  selector: 'app-distributor-staff-directory',
  standalone: true,
  imports: [FormValidationSummaryComponent, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './staff-directory.component.html',
})
export class StaffDirectoryComponent {
  private readonly service = inject(DistributorStaffService);
  private readonly fb = inject(FormBuilder);
  protected readonly members = this.service.members;
  protected readonly selected = signal('ALL');
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly filtered = computed(() =>
    this.members().filter(
      (member) =>
        (this.selected() === 'ALL' || member.status === this.selected()) &&
        (!this.query() ||
          [member.name, member.email].some((value) =>
            value.toLowerCase().includes(this.query().toLowerCase()),
          )),
    ),
  );
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
    email: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
  });
  protected filterStatus(event: Event): void {
    this.selected.set((event.target as HTMLSelectElement).value);
  }
  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
  protected invite(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      const member = this.service.invite(this.form.getRawValue());
      this.notice.set(`${member.name} added with pending invitation status.`);
      this.open.set(false);
      this.form.reset({ name: '', email: '' });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to add team member.');
    }
  }
  protected changeStatus(member: DistributorStaffMember, status: DistributorStaffStatus): void {
    this.notice.set(
      this.service.updateStatus(member.id, status)
        ? 'Team member access updated.'
        : 'Team member could not be updated.',
    );
  }
  protected approve(member: DistributorStaffMember): void {
    this.changeStatus(member, 'ACTIVE');
  }
}
