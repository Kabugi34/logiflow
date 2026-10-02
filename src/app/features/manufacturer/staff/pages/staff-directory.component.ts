import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DriverStatus } from '../../fleet/fleet.models';
import { ManufacturerStaffService } from '../staff.service';
import { ManufacturerStaffMember, StaffCategory, StaffStatus } from '../staff.models';

@Component({
  selector: 'app-staff-directory',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './staff-directory.component.html'
})
export class StaffDirectoryComponent {
  private readonly staffService = inject(ManufacturerStaffService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly staff = this.staffService.members;
  protected readonly warehouses = this.staffService.warehouses;
  protected readonly jobTitles = this.staffService.jobTitles;
  protected readonly selectedCategory = signal<'ALL' | StaffCategory>('ALL');
  protected readonly selectedStatus = signal<'ALL' | StaffStatus>('ALL');
  protected readonly searchTerm = signal('');
  protected readonly selectedMemberId = signal<string | null>(null);
  protected readonly isInviteOpen = signal(false);
  protected readonly inviteError = signal('');
  protected readonly driverActionMessage = signal('');
  protected readonly selectedMember = computed(() => this.staff().find(member => member.id === this.selectedMemberId()) ?? null);
  protected readonly summary = computed(() => ({
    employees: this.staff().filter(member => member.category === 'EMPLOYEE').length,
    drivers: this.staff().filter(member => member.category === 'DRIVER').length
  }));
  protected readonly filteredStaff = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.staff().filter(member => {
      const queryMatches = !query || [member.name, member.email, member.jobTitle, member.warehouseName].some(value => value.toLowerCase().includes(query));
      const categoryMatches = this.selectedCategory() === 'ALL' || member.category === this.selectedCategory();
      const statusMatches = this.selectedStatus() === 'ALL' || member.status === this.selectedStatus();
      return queryMatches && categoryMatches && statusMatches;
    });
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    jobTitle: ['Warehouse Supervisor', Validators.required],
    warehouseId: [this.warehouses()[0]?.id ?? '', Validators.required]
  });

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value as 'ALL' | StaffCategory);
  }

  protected updateStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value as 'ALL' | StaffStatus);
  }

  protected openInvite(): void {
    this.form.reset({ name: '', email: '', jobTitle: 'Warehouse Supervisor', warehouseId: this.warehouses()[0]?.id ?? '' });
    this.inviteError.set('');
    this.isInviteOpen.set(true);
  }

  protected closeInvite(): void {
    this.isInviteOpen.set(false);
  }

  protected sendInvitation(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      this.staffService.inviteEmployee(this.form.getRawValue());
      const invitedMember = this.staff().at(-1);
      this.selectedCategory.set('ALL');
      this.selectedStatus.set('ALL');
      this.searchTerm.set('');
      this.selectedMemberId.set(invitedMember?.id ?? null);
      this.isInviteOpen.set(false);
    } catch (error) {
      this.inviteError.set(error instanceof Error ? error.message : 'Unable to send this invitation.');
    }
  }

  protected manage(member: ManufacturerStaffMember): void {
    this.selectedMemberId.set(this.selectedMemberId() === member.id ? null : member.id);
  }

  protected updateSelectedStatus(event: Event): void {
    const member = this.selectedMember();
    if (!member || member.category === 'DRIVER') return;
    this.staffService.updateEmployeeStatus(member.id, (event.target as HTMLSelectElement).value as StaffStatus);
  }

  protected approveDriver(id: string): void {
    this.updateDriverStatus(id, 'STANDBY');
  }

  protected suspendDriver(id: string): void {
    this.updateDriverStatus(id, 'SUSPENDED');
  }

  protected reinstateDriver(id: string): void {
    this.updateDriverStatus(id, 'STANDBY');
  }

  private updateDriverStatus(id: string, status: DriverStatus): void {
    this.driverActionMessage.set('');
    const updated = this.staffService.updateDriverStatus(id, status);
    this.driverActionMessage.set(updated
      ? `Driver status updated to ${status === 'STANDBY' ? 'standby' : 'suspended'}.`
      : 'This driver has an active trip. Complete or reassign it before changing to this status.');
  }

  protected statusClass(status: StaffStatus): string {
    switch (status) {
      case 'ACTIVE': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'PENDING': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'SUSPENDED': return 'border-red-200 bg-red-50 text-red-700';
    }
  }

  protected accessRoleLabel(role: string): string {
    return role === 'MANUFACTURER_ADMIN' ? 'Manufacturer Admin' : 'Manufacturer Staff';
  }
}
