import { describe, expect, it, vi } from 'vitest';

import {
  buildAccessClaims,
  parseAccessUsers,
  syncAuthAccess,
} from './sync-auth-access.mjs';

describe('sync-auth-access', () => {
  it('parses exactly two distinct access users', () => {
    expect(
      parseAccessUsers({
        APP_LOGIN_PARTNER_EMAIL: ' Partner@Example.com ',
        APP_LOGIN_PRIMARY_EMAIL: ' Primary@Example.com ',
      }),
    ).toEqual([
      {
        email: 'primary@example.com',
        slot: 'primary',
      },
      {
        email: 'partner@example.com',
        slot: 'partner',
      },
    ]);

    expect(() =>
      parseAccessUsers({
        APP_LOGIN_PARTNER_EMAIL: 'primary@example.com',
        APP_LOGIN_PRIMARY_EMAIL: 'Primary@Example.com',
      }),
    ).toThrow('must differ');
  });

  it('grants access to the two configured users and revokes stale members', async () => {
    const auth = createAuthMock([
      {
        customClaims: {},
        email: 'primary@example.com',
        uid: 'uid-primary',
      },
      {
        customClaims: {
          role: 'kept',
          secretFaeriesMember: true,
        },
        email: 'partner@example.com',
        uid: 'uid-partner',
      },
      {
        customClaims: {
          gardenAccess: true,
          role: 'kept',
          secretFaeriesMember: true,
        },
        email: 'stale@example.com',
        uid: 'uid-stale',
      },
      {
        customClaims: {},
        email: 'outsider@example.com',
        uid: 'uid-outsider',
      },
    ]);

    const result = await syncAuthAccess({
      auth,
      users: parseAccessUsers({
        APP_LOGIN_PARTNER_EMAIL: 'partner@example.com',
        APP_LOGIN_PRIMARY_EMAIL: 'primary@example.com',
      }),
    });

    expect(auth.setCustomUserClaims).toHaveBeenCalledTimes(3);
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('uid-primary', {
      gardenAccess: true,
      secretFaeriesMember: true,
    });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('uid-partner', {
      gardenAccess: true,
      role: 'kept',
      secretFaeriesMember: true,
    });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('uid-stale', {
      role: 'kept',
    });
    expect(result.granted.map((user) => user.action)).toEqual([
      'granted',
      'granted',
    ]);
    expect(result.revoked).toEqual([
      {
        action: 'revoked',
        email: 'st***@example.com',
        uid: 'uid-stale',
      },
    ]);
  });

  it('supports dry-run without writing custom claims', async () => {
    const auth = createAuthMock([
      {
        customClaims: {},
        email: 'primary@example.com',
        uid: 'uid-primary',
      },
      {
        customClaims: {},
        email: 'partner@example.com',
        uid: 'uid-partner',
      },
    ]);

    const result = await syncAuthAccess({
      auth,
      dryRun: true,
      users: parseAccessUsers({
        APP_LOGIN_PARTNER_EMAIL: 'partner@example.com',
        APP_LOGIN_PRIMARY_EMAIL: 'primary@example.com',
      }),
    });

    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(result.granted.map((user) => user.action)).toEqual([
      'would-grant',
      'would-grant',
    ]);
  });

  it('clears only managed access claims when revoking', () => {
    expect(
      buildAccessClaims(
        {
          gardenAccess: true,
          role: 'kept',
          secretFaeriesMember: true,
        },
        false,
      ),
    ).toEqual({
      role: 'kept',
    });
    expect(
      buildAccessClaims(
        {
          gardenAccess: true,
          secretFaeriesMember: true,
        },
        false,
      ),
    ).toBeNull();
  });
});

function createAuthMock(users) {
  return {
    getUserByEmail: vi.fn(async (email) => {
      const user = users.find((candidate) => candidate.email === email);

      if (!user) {
        const error = new Error('missing');
        error.code = 'auth/user-not-found';
        throw error;
      }

      return user;
    }),
    listUsers: vi.fn(async () => ({
      users,
    })),
    setCustomUserClaims: vi.fn(async () => undefined),
  };
}
