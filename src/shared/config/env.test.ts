import { describe, expect, it } from 'vitest';

import { resolveAppEnvironmentFromEnv } from './env';

describe('resolveAppEnvironmentFromEnv', () => {
  it('normalizes exactly two allowed emails', () => {
    const environment = resolveAppEnvironmentFromEnv({
      VITE_ALLOWED_EMAILS: ' Primary.Gardener@example.com , Partner.Gardener@example.com ',
    });

    expect(environment.allowedEmails).toEqual([
      'primary.gardener@example.com',
      'partner.gardener@example.com',
    ]);
    expect(environment.allowlistError).toBeNull();
  });

  it('fails closed when the allowlist is duplicated after normalization', () => {
    const environment = resolveAppEnvironmentFromEnv({
      VITE_ALLOWED_EMAILS: 'Primary.Gardener@example.com,primary.gardener@example.com',
    });

    expect(environment.allowedEmails).toEqual([]);
    expect(environment.allowlistError).toContain('exactly two distinct');
  });

  it('falls back to mock mode when firebase config is incomplete', () => {
    const environment = resolveAppEnvironmentFromEnv({
      VITE_ALLOWED_EMAILS: 'primary.gardener@example.com,partner.gardener@example.com',
      VITE_APP_RUNTIME: 'firebase',
      VITE_FIREBASE_API_KEY: 'api-key-only',
    });

    expect(environment.requestedMode).toBe('firebase');
    expect(environment.runtimeMode).toBe('mock');
    expect(environment.fallbackReason).toContain('VITE_FIREBASE_*');
  });

  it('keeps the optional browser geocoding key outside Firebase mode checks', () => {
    const environment = resolveAppEnvironmentFromEnv({
      VITE_FIREBASE_MESSAGING_VAPID_KEY: 'vapid-key',
      VITE_GOOGLE_MAPS_API_KEY: 'maps-key',
    });

    expect(environment.runtimeMode).toBe('mock');
    expect(environment.geocodingApiKey).toBe('maps-key');
    expect(environment.messagingVapidKey).toBe('vapid-key');
  });

  it('enables Tomorrow weather only when explicitly configured', () => {
    const disabledEnvironment = resolveAppEnvironmentFromEnv({
      VITE_TOMORROW_API_KEY: 'tomorrow-key',
    });
    const enabledEnvironment = resolveAppEnvironmentFromEnv({
      VITE_ENABLE_TOMORROW_WEATHER: 'true',
      VITE_TOMORROW_API_KEY: 'tomorrow-key',
    });

    expect(disabledEnvironment.tomorrowApiKey).toBe('tomorrow-key');
    expect(disabledEnvironment.tomorrowWeatherEnabled).toBe(false);
    expect(enabledEnvironment.tomorrowWeatherEnabled).toBe(true);
  });

  it('supports the mock-safe defaults when env values are omitted', () => {
    const environment = resolveAppEnvironmentFromEnv({});

    expect(environment.runtimeMode).toBe('mock');
    expect(environment.allowedEmails).toEqual([
      'primary.gardener@example.com',
      'partner.gardener@example.com',
    ]);
    expect(environment.allowlistError).toBeNull();
  });
});
