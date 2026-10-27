import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppearanceService } from '../../../../core/services/appearance.service';
import { ManufacturerWarehouseService } from '../../warehouses/warehouse.service';
import { ManufacturerSettingsService } from '../settings.service';
import { NotificationPreferenceKey } from '../settings.models';
import { trimmedRequired } from '../../../../core/forms/form-validators';

@Component({
  selector: 'app-settings-center',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './settings-center.component.html',
})
export class SettingsCenterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly settingsService = inject(ManufacturerSettingsService);
  protected readonly appearance = inject(AppearanceService);
  protected readonly isDarkTheme = computed(() => this.appearance.isDark());
  protected readonly warehouseService = inject(ManufacturerWarehouseService);
  protected readonly profile = this.settingsService.profile;
  protected readonly notifications = this.settingsService.notifications;
  protected readonly savedMessage = signal('');
  protected readonly saving = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group({
    registeredName: [this.profile().registeredName, [trimmedRequired, Validators.maxLength(120)]],
    taxRegistrationId: [
      this.profile().taxRegistrationId,
      [trimmedRequired, Validators.maxLength(48), Validators.pattern(/^[A-Za-z0-9/-]+$/)],
    ],
  });
  protected readonly regionalForm = this.formBuilder.nonNullable.group({
    timezone: [this.profile().timezone, Validators.required],
    defaultWarehouseId: [this.profile().defaultWarehouseId, Validators.required],
  });
  protected readonly timezones = [
    { value: 'Africa/Nairobi', label: 'East Africa Time (Nairobi)' },
    { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  ];

  protected saveProfile(): void {
    this.savedMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.settingsService.updateProfile({ ...this.profile(), ...this.form.getRawValue() }).subscribe({
      next: () => { this.savedMessage.set('Organization settings saved.'); this.saving.set(false); },
      error: error => { this.savedMessage.set(error?.error?.message ?? 'Organization settings could not be saved.'); this.saving.set(false); }
    });
  }

  protected updateNotification(key: NotificationPreferenceKey, event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.settingsService.updateNotification(key, enabled).subscribe({
      error: error => { this.savedMessage.set(error?.error?.message ?? 'Notification preference could not be saved.'); }
    });
  }

  protected saveRegionalDefaults(): void {
    if (this.regionalForm.invalid) {
      this.regionalForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.settingsService.updateProfile({ ...this.profile(), ...this.regionalForm.getRawValue() }).subscribe({
      next: saved => { this.form.patchValue(saved); this.savedMessage.set('Regional defaults saved.'); this.saving.set(false); },
      error: error => { this.savedMessage.set(error?.error?.message ?? 'Regional defaults could not be saved.'); this.saving.set(false); }
    });
  }

  protected toggleTheme(): void {
    this.appearance.toggle();
  }
}
