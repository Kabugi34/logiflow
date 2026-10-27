import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { NotificationPreferences, OrganizationProfile } from './settings.models';
import { Observable, tap } from 'rxjs';

const defaultProfile: OrganizationProfile = { registeredName: '', taxRegistrationId: '', timezone: '', defaultWarehouseId: '' };
const defaultNotifications: NotificationPreferences = { dispatchExceptionsSms: false, purchaseOrderApprovalsEmail: false, weeklyCapacityForecasts: false };

@Injectable({ providedIn: 'root' })
export class ManufacturerSettingsService {
  private readonly http = inject(HttpClient);
  private readonly organizationProfile = signal(defaultProfile);
  private readonly notificationPreferences = signal(defaultNotifications);
  readonly profile = this.organizationProfile.asReadonly();
  readonly notifications = this.notificationPreferences.asReadonly();

  constructor() { this.refresh(); }

  refresh(): void {
    this.http.get<Partial<OrganizationProfile>>(API_ENDPOINTS.manufacturer.organization).subscribe({
      next: value => this.organizationProfile.set({ ...defaultProfile, ...value }),
      error: () => undefined
    });
    this.http.get<Partial<NotificationPreferences>>(API_ENDPOINTS.manufacturer.organizationNotificationPreferences).subscribe({
      next: value => this.notificationPreferences.set({ ...defaultNotifications, ...value }),
      error: () => undefined
    });
  }

  updateProfile(profile: OrganizationProfile): Observable<OrganizationProfile> {
    return this.http.patch<OrganizationProfile>(API_ENDPOINTS.manufacturer.organization, profile)
      .pipe(tap(saved => this.organizationProfile.set({ ...defaultProfile, ...saved })));
  }

  updateNotification<K extends keyof NotificationPreferences>(key: K, enabled: boolean): Observable<NotificationPreferences> {
    const updated = { ...this.notificationPreferences(), [key]: enabled };
    return this.http.patch<NotificationPreferences>(API_ENDPOINTS.manufacturer.organizationNotificationPreferences, updated)
      .pipe(tap(saved => this.notificationPreferences.set({ ...defaultNotifications, ...saved })));
  }
}
