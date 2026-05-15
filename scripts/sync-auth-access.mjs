import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { createFirebaseCliAuthClient } from './firebase-cli-auth-client.mjs';

export const requiredAccessClaims = Object.freeze({
  gardenAccess: true,
  secretFaeriesMember: true,
});

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function maskEmail(email) {
  const [name = '', domain = ''] = email.split('@');
  const visibleName =
    name.length <= 2 ? `${name.slice(0, 1)}*` : `${name.slice(0, 2)}***`;

  return `${visibleName}@${domain}`;
}

export function parseAccessUsers(env = process.env) {
  const users = [
    ['primary', 'APP_LOGIN_PRIMARY_EMAIL'],
    ['partner', 'APP_LOGIN_PARTNER_EMAIL'],
  ].map(([slot, name]) => ({
    email: normalizeEmail(readRequiredEnv(name, env)),
    slot,
  }));
  const distinctEmails = new Set(users.map((user) => user.email));

  if (distinctEmails.size !== users.length) {
    throw new Error(
      'APP_LOGIN_PRIMARY_EMAIL and APP_LOGIN_PARTNER_EMAIL must differ.',
    );
  }

  return users;
}

export async function syncAuthAccess({ auth, dryRun = false, users }) {
  const allowedUids = new Set();
  const granted = [];

  for (const user of users) {
    const firebaseUser = await getUserByEmail(auth, user.email);

    allowedUids.add(firebaseUser.uid);

    const nextClaims = buildAccessClaims(firebaseUser.customClaims, true);
    const changed = !claimsEqual(firebaseUser.customClaims, nextClaims);

    if (changed && !dryRun) {
      await auth.setCustomUserClaims(firebaseUser.uid, nextClaims);
    }

    granted.push({
      action: changed ? (dryRun ? 'would-grant' : 'granted') : 'unchanged',
      email: maskEmail(user.email),
      slot: user.slot,
      uid: firebaseUser.uid,
    });
  }

  const revoked = [];
  const firebaseUsers = await listAllUsers(auth);

  for (const firebaseUser of firebaseUsers) {
    if (
      allowedUids.has(firebaseUser.uid) ||
      !hasManagedAccessClaim(firebaseUser.customClaims)
    ) {
      continue;
    }

    const nextClaims = buildAccessClaims(firebaseUser.customClaims, false);

    if (!dryRun) {
      await auth.setCustomUserClaims(firebaseUser.uid, nextClaims);
    }

    revoked.push({
      action: dryRun ? 'would-revoke' : 'revoked',
      email: firebaseUser.email ? maskEmail(firebaseUser.email) : null,
      uid: firebaseUser.uid,
    });
  }

  return {
    granted,
    revoked,
  };
}

export function buildAccessClaims(existingClaims = {}, shouldGrant) {
  const claims = { ...existingClaims };

  if (shouldGrant) {
    claims.gardenAccess = true;
    claims.secretFaeriesMember = true;
  } else {
    delete claims.gardenAccess;
    delete claims.secretFaeriesMember;
  }

  return Object.keys(claims).length > 0 ? claims : null;
}

export function hasManagedAccessClaim(claims = {}) {
  return claims.gardenAccess === true || claims.secretFaeriesMember === true;
}

export function loadEnvFile(path, env = process.env) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

    if (!env[key]) {
      env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}

async function getUserByEmail(auth, email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      throw new Error(
        `Firebase Auth user ${maskEmail(email)} was not found. Seed it with npm run auth:seed-users before syncing access.`,
      );
    }

    throw error;
  }
}

async function listAllUsers(auth) {
  const users = [];
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);

    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

function claimsEqual(leftClaims = null, rightClaims = null) {
  return (
    JSON.stringify(sortClaims(leftClaims)) ===
    JSON.stringify(sortClaims(rightClaims))
  );
}

function sortClaims(claims) {
  if (!claims) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(claims).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey),
    ),
  );
}

function readRequiredEnv(name, env) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function getProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    null
  );
}

function getAdminAuth(projectId) {
  const require = createRequire(
    pathToFileURL(`${process.cwd()}/functions/package.json`),
  );
  const admin = require('firebase-admin');

  if (!admin.apps.length) {
    admin.initializeApp(projectId ? { projectId } : undefined);
  }

  return admin.auth();
}

async function getAuthClient(projectId) {
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is required.');
  }

  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_CONFIG
  ) {
    return {
      auth: getAdminAuth(projectId),
      source: 'application-default-credentials',
    };
  }

  return {
    auth: await createFirebaseCliAuthClient(projectId),
    source: 'firebase-cli',
  };
}

async function main() {
  loadEnvFile('.env.local');

  const dryRun = process.argv.includes('--dry-run');
  const projectId = getProjectId();
  const users = parseAccessUsers();
  const authClient = await getAuthClient(projectId);
  const result = await syncAuthAccess({
    auth: authClient.auth,
    dryRun,
    users,
  });

  console.log(
    JSON.stringify(
      {
        authSource: authClient.source,
        dryRun,
        managedClaims: requiredAccessClaims,
        projectId,
        ...result,
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Unknown auth access sync error.',
    );
    process.exitCode = 1;
  });
}
