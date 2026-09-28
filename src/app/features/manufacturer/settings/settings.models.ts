export interface OrganizationProfile {
  registeredName: string;
  taxRegistrationId: string;
  timezone: string;
  defaultWarehouseId: string;
}

export interface NotificationPreferences {
  dispatchExceptionsSms: boolean;
  purchaseOrderApprovalsEmail: boolean;
  weeklyCapacityForecasts: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;
