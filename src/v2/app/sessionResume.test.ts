import { beforeEach, describe, expect, it } from 'vitest';

import {
  getPostSignInRoute,
  readLastAppRoute,
  rememberAppRoute,
  sanitizeAppRoute,
} from './sessionResume';

describe('v2 session route memory', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps only canonical authenticated workspace routes', () => {
    expect(sanitizeAppRoute('/app/garden?plantingId=tomato')).toBe(
      '/app/plan?plantingId=tomato',
    );
    expect(sanitizeAppRoute('/app/tasks')).toBe('/app/today');
    expect(sanitizeAppRoute('/app/journal')).toBe('/app/feed');
    expect(sanitizeAppRoute('https://attacker.example/app/plan')).toBeNull();
    expect(sanitizeAppRoute('//attacker.example/app/plan')).toBeNull();
    expect(sanitizeAppRoute('/settings')).toBeNull();
  });

  it('remembers a safe route and falls back when input is unsafe', () => {
    rememberAppRoute('/app/settings');
    expect(readLastAppRoute()).toBe('/app/settings');
    rememberAppRoute('https://attacker.example/app/plan');
    expect(readLastAppRoute()).toBe('/app/settings');
  });

  it('prefers a safe requested destination after sign-in', () => {
    rememberAppRoute('/app/feed');
    expect(getPostSignInRoute({ returnTo: '/app/today?focus=watering' })).toBe(
      '/app/today?focus=watering',
    );
    expect(getPostSignInRoute({ returnTo: 'https://attacker.example' })).toBe(
      '/app/feed',
    );
  });
});
