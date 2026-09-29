import { Injectable, signal } from '@angular/core';
import { NotificationPreferences, OrganizationProfile } from './settings.models';

const PROFILE_STORAGE_KEY = 'logiflow.manufacturer.organizationProfile';
const NOTIFICATION_STORAGE_KEY = 'logiflow.manufacturer.notificationPreferences';

const defaultProfile: OrganizationProfile = {
  registeredName: 'LogiCore Manufacturing Ltd.',
  taxRegistrationId: 'US-VAT-8910492B',
  timezone: 'America/Chicago',
  defaultWarehouseId: 'CHI-A1'
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
      return { ...fallback, ...JSON.parse(stored) as Partial<T> };
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
