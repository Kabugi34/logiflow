import { isDevMode } from '@angular/core';
import { API_CONFIG } from './api.config';

/**
 * Production builds must never ship with mock auth or demo payment UI enabled.
 * Throws during bootstrap so a misconfigured build fails closed.
 */
export function assertProductionSafeConfig(): void {
  if (isDevMode()) {
    return;
  }
  if (API_CONFIG.useMockAuth) {
    throw new Error('API_CONFIG.useMockAuth must be false in production builds.');
  }
  if (API_CONFIG.allowDemoPayments) {
    throw new Error('API_CONFIG.allowDemoPayments must be false in production builds.');
  }
}
