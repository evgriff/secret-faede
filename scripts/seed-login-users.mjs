import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
const admin = require('firebase-admin');

loadEnvFile('.env.local');

const dryRun = process.argv.includes('--dry-run');
const resetPasswords = process.argv.includes('--reset-passwords');
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID;
const users = [
  {
    displayName: 'Primary Gardener',
    email: readRequiredEnv('APP_LOGIN_PRIMARY_EMAIL'),
    password: readRequiredEnv('APP_LOGIN_PRIMARY_TEMP_PASSWORD'),
    slot: 'evan',
  },
  {
    displayName: 'Partner Gardener',
    email: readRequiredEnv('APP_LOGIN_PARTNER_EMAIL'),
    password: readRequiredEnv('APP_LOGIN_PARTNER_TEMP_PASSWORD'),
    slot: 'emma',
  },
].map((user) => ({
  ...user,
  email: normalizeEmail(user.email),
}));

assertDistinctUsers(users);

if (!dryRun && !admin.apps.length) {
  admin.initializeApp(projectId ? { projectId } : undefined);
}

const results = [];

for (const user of users) {
  results.push(dryRun ? dryRunUser(user) : await seedUser(user));
}

console.log(
  JSON.stringify(
    {
      dryRun,
      projectId: projectId ?? null,
      resetPasswords,
      users: results,
    },
    null,
    2,
  ),
);

async function seedUser(user) {
  const auth = admin.auth();
  const existing = await auth.getUserByEmail(user.email).catch((error) => {
    if (error?.code === 'auth/user-not-found') {
      return null;
    }

    throw error;
  });
  const firebaseUser = existing
    ? await auth.updateUser(existing.uid, {
        disabled: false,
        displayName: user.displayName,
        emailVerified: true,
        ...(resetPasswords ? { password: user.password } : {}),
      })
    : await auth.createUser({
        disabled: false,
        displayName: user.displayName,
        email: user.email,
        emailVerified: true,
        password: user.password,
      });
  const claims = {
    ...(firebaseUser.customClaims ?? {}),
    gardenAccess: true,
    secretFaeriesMember: true,
  };

  await auth.setCustomUserClaims(firebaseUser.uid, claims);

  return {
    action: existing ? 'updated' : 'created',
    claims,
    displayName: user.displayName,
    email: user.email,
    passwordUpdated: !existing || resetPasswords,
    uid: firebaseUser.uid,
  };
}

function dryRunUser(user) {
  return {
    action: 'dry-run',
    claims: {
      gardenAccess: true,
      secretFaeriesMember: true,
    },
    displayName: user.displayName,
    email: user.email,
    passwordUpdated: resetPasswords,
    uid: null,
  };
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function assertDistinctUsers(values) {
  const emails = values.map((value) => value.email);

  if (new Set(emails).size !== emails.length) {
    throw new Error(
      'APP_LOGIN_PRIMARY_EMAIL and APP_LOGIN_PARTNER_EMAIL must differ.',
    );
  }
}

function loadEnvFile(path) {
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

    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}
