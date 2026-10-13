import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppearanceService } from '../../../../core/services/appearance.service';
import { ManufacturerWarehouseService } from '../../warehouses/warehouse.service';
import { ManufacturerSettingsService } from '../settings.service';
import { NotificationPreferenceKey } from '../settings.models';

@Component({
  selector: 'app-settings-center',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './settings-center.component.html'
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
  protected readonly form = this.formBuilder.nonNullable.group({
    registeredName: [this.profile().registeredName, [Validators.required, Validators.maxLength(120)]],
    taxRegistrationId: [this.profile().taxRegistrationId, [Validators.required, Validators.maxLength(48)]]
  });
  protected readonly regionalForm = this.formBuilder.nonNullable.group({
    timezone: [this.profile().timezone, Validators.required],
    defaultWarehouseId: [this.profile().defaultWarehouseId, Validators.required]
  });
  protected readonly timezones = [
    { value: 'Africa/Nairobi', label: 'East Africa Time (Nairobi)' },
    { value: 'UTC', label: 'Coordinated Universal Time (UTC)' }
  ];

  protected saveProfile(): void {
    this.savedMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.settingsService.updateProfile({ ...this.profile(), ...this.form.getRawValue() });
    this.savedMessage.set('Organization settings saved.');
  }

  protected updateNotification(key: NotificationPreferenceKey, event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.settingsService.updateNotification(key, enabled);
  }

  protected saveRegionalDefaults(): void {
    if (this.regionalForm.invalid) {
      this.regionalForm.markAllAsTouched();
      return;
    }
    this.settingsService.updateProfile({ ...this.profile(), ...this.regionalForm.getRawValue() });
    this.form.patchValue(this.profile());
    this.savedMessage.set('Regional defaults saved.');
  }

  protected toggleTheme(): void {
    this.appearance.toggle();
  }
}
