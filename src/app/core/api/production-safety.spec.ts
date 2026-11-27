import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_CONFIG } from './api.config';
import { assertProductionSafeConfig } from './production-safety';

vi.mock('@angular/core', async () => {
  const actual = await vi.importActual<typeof import('@angular/core')>('@angular/core');
  return {
    ...actual,
    isDevMode: vi.fn(),
  };
});

import { isDevMode } from '@angular/core';

describe('assertProductionSafeConfig', () => {
  const originalMockAuth = API_CONFIG.useMockAuth;
  const originalDemoPayments = API_CONFIG.allowDemoPayments;

  afterEach(() => {
    API_CONFIG.useMockAuth = originalMockAuth;
    API_CONFIG.allowDemoPayments = originalDemoPayments;
    vi.mocked(isDevMode).mockReset();
  });

  it('allows any flags while in development mode', () => {
    vi.mocked(isDevMode).mockReturnValue(true);
    API_CONFIG.useMockAuth = true;
    API_CONFIG.allowDemoPayments = true;
    expect(() => assertProductionSafeConfig()).not.toThrow();
  });

  it('refuses mock auth in production builds', () => {
    vi.mocked(isDevMode).mockReturnValue(false);
    API_CONFIG.useMockAuth = true;
    API_CONFIG.allowDemoPayments = false;
    expect(() => assertProductionSafeConfig()).toThrow(/useMockAuth/);
  });

  it('refuses demo payments in production builds', () => {
    vi.mocked(isDevMode).mockReturnValue(false);
    API_CONFIG.useMockAuth = false;
    API_CONFIG.allowDemoPayments = true;
    expect(() => assertProductionSafeConfig()).toThrow(/allowDemoPayments/);
  });

  it('passes when production flags are false', () => {
    vi.mocked(isDevMode).mockReturnValue(false);
    API_CONFIG.useMockAuth = false;
    API_CONFIG.allowDemoPayments = false;
    expect(() => assertProductionSafeConfig()).not.toThrow();
  });
});
