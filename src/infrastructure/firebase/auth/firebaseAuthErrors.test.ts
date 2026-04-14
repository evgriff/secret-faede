import { describe, expect, it } from 'vitest';

import { getFirebaseAuthErrorMessage } from './firebaseAuthErrors';

describe('getFirebaseAuthErrorMessage', () => {
  it('maps missing auth configuration to an actionable setup message', () => {
    expect(
      getFirebaseAuthErrorMessage({ code: 'auth/configuration-not-found' }),
    ).toContain('enable Email/Password and Email link sign-in');
  });

  it('maps unauthorized domain to an authorized domains message', () => {
    expect(
      getFirebaseAuthErrorMessage({ code: 'auth/unauthorized-domain' }),
    ).toContain('Authorized domains');
  });

  it('falls back to the original SDK message when available', () => {
    expect(
      getFirebaseAuthErrorMessage({
        code: 'auth/internal-error',
        message: 'Something specific happened.',
      }),
    ).toBe('Something specific happened.');
  });
});
