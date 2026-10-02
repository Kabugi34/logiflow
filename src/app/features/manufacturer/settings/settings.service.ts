import { Injectable, signal } from '@angular/core';
import { NotificationPreferences, OrganizationProfile } from './settings.models';

const PROFILE_STORAGE_KEY = 'logiflow.manufacturer.organizationProfile';
const NOTIFICATION_STORAGE_KEY = 'logiflow.manufacturer.notificationPreferences';

const defaultProfile: OrganizationProfile = {
  registeredName: 'LogiCore Manufacturing Ltd.',
  taxRegistrationId: 'P051234567X',
  timezone: 'Africa/Nairobi',
  defaultWarehouseId: 'NBO-A1'
};

const defaultNotifications: NotificationPreferences = {
  dispatchExceptionsSms: true,
  purchaseOrderApprovalsEmail: true,
  weeklyCapacityForecasts: false
};

@Injectable({ providedIn: 'root' })
export class ManufacturerSettingsService {
  private readonly organizationProfile = signal(this.readStored(PROFILE_STORAGE_KEY, defaultProfile));
  private readonly notificationPreferences = signal(this.readStored(NOTIFICATION_STORAGE_KEY, defaultNotifications));

  readonly profile = this.organizationProfile.asReadonly();
  readonly notifications = this.notificationPreferences.asReadonly();

  updateProfile(profile: OrganizationProfile): void {
    const normalizedProfile = {
      ...profile,
      registeredName: profile.registeredName.trim(),
      taxRegistrationId: profile.taxRegistrationId.trim().toUpperCase()
    };
    this.organizationProfile.set(normalizedProfile);
    this.writeStored(PROFILE_STORAGE_KEY, normalizedProfile);
  }

  updateNotification<K extends keyof NotificationPreferences>(key: K, enabled: boolean): void {
    const updated = { ...this.notificationPreferences(), [key]: enabled };
    this.notificationPreferences.set(updated);
    this.writeStored(NOTIFICATION_STORAGE_KEY, updated);
  }

  private readStored<T extends object>(key: string, fallback: T): T {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const stored = localStorage.getItem(key);
      if (!stored) return fallback;
      const value = { ...fallback, ...JSON.parse(stored) as Partial<T> };

      if (key === PROFILE_STORAGE_KEY) {
        const profile = value as unknown as OrganizationProfile;
        if (profile.defaultWarehouseId === 'CHI-A1') profile.defaultWarehouseId = 'NBO-A1';
        if (profile.defaultWarehouseId === 'HOU-C4') profile.defaultWarehouseId = 'MBA-C4';
        if (profile.timezone.startsWith('America/')) profile.timezone = 'Africa/Nairobi';
        if (profile.taxRegistrationId.startsWith('US-')) profile.taxRegistrationId = 'P051234567X';
      }

      return value;
    } catch {
      return fallback;
    }
  }

  private writeStored<T extends object>(key: string, value: T): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  }
}
