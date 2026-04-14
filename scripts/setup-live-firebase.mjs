import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'secret-faeries';
const defaultGardenId = 'north-lot';
const requiredAuthorizedDomains = [
  '127.0.0.1',
  'localhost',
  `${projectId}.firebaseapp.com`,
  `${projectId}.web.app`,
];

function uniqueInOrder(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function toFirestoreValue(value) {
  if (value === null) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => toFirestoreValue(entry)),
      },
    };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'object' && value) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .map(([key, entry]) => [key, toFirestoreValue(entry)]),
        ),
      },
    };
  }

  throw new Error(`Unsupported Firestore value: ${String(value)}`);
}

async function fetchJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.accessToken
      ? { Authorization: `Bearer ${options.accessToken}` }
      : {}),
  };
  const response = await fetch(url, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? 'GET',
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status}) for ${url}: ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

async function getCliSession() {
  const account = auth.getGlobalDefaultAccount();

  if (!account?.tokens?.refresh_token || !account.user?.email) {
    throw new Error('Firebase CLI login is required. Run `firebase login` first.');
  }

  const token = await auth.getAccessToken(account.tokens.refresh_token, []);

  if (!token?.access_token) {
    throw new Error('Unable to get an access token from the Firebase CLI session.');
  }

  return {
    accessToken: token.access_token,
    email: normalizeEmail(account.user.email),
  };
}

async function getProjectAuthConfig(session) {
  return fetchJson(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
    { accessToken: session.accessToken },
  );
}

async function updateProjectAuthConfig(session, authorizedDomains) {
  return fetchJson(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains`,
    {
      accessToken: session.accessToken,
      body: {
        authorizedDomains,
        signIn: {
          email: {
            enabled: true,
            passwordRequired: false,
          },
        },
      },
      method: 'PATCH',
    },
  );
}

async function ensureProjectAuthConfig(session) {
  const config = await getProjectAuthConfig(session);
  const authorizedDomains = uniqueInOrder([
    ...(config.authorizedDomains ?? []),
    ...requiredAuthorizedDomains,
  ]);
  const emailEnabled = config.signIn?.email?.enabled === true;
  const emailLinkEnabled = config.signIn?.email?.passwordRequired === false;
  const needsPatch =
    !emailEnabled ||
    !emailLinkEnabled ||
    authorizedDomains.length !== (config.authorizedDomains ?? []).length;

  if (!needsPatch) {
    return {
      changed: false,
      config,
    };
  }

  const updatedConfig = await updateProjectAuthConfig(
    session,
    authorizedDomains,
  );

  return {
    changed: true,
    config: updatedConfig,
  };
}

async function lookupAuthUser(session, email) {
  const payload = await fetchJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      accessToken: session.accessToken,
      body: {
        email: [email],
      },
      method: 'POST',
    },
  );

  return payload.users?.[0] ?? null;
}

async function createAuthUser(session, apiKey, email) {
  return fetchJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts?key=${apiKey}`,
    {
      accessToken: session.accessToken,
      body: {
        email,
        emailVerified: false,
      },
      method: 'POST',
    },
  );
}

async function ensureAuthUser(session, apiKey, email) {
  const existingUser = await lookupAuthUser(session, email);

  if (existingUser) {
    return {
      created: false,
      email,
      uid: existingUser.localId,
    };
  }

  const createdUser = await createAuthUser(session, apiKey, email);

  return {
    created: true,
    email,
    uid: createdUser.localId,
  };
}

function buildSeedDocuments(uid, email) {
  const now = new Date().toISOString();

  return [
    {
      data: {
        createdAt: now,
        displayName: null,
        email,
        lastGardenId: defaultGardenId,
        updatedAt: now,
      },
      path: `users/${uid}`,
    },
    {
      data: {
        createdAt: now,
        dimensions: {
          height: 32,
          unit: 'ft',
          width: 18,
        },
        name: 'North Lot',
        ownerUid: uid,
        slug: defaultGardenId,
        timezone: 'America/Detroit',
        updatedAt: now,
      },
      path: `gardens/${defaultGardenId}`,
    },
    {
      data: {
        createdAt: now,
        role: 'owner',
        uid,
      },
      path: `gardens/${defaultGardenId}/members/${uid}`,
    },
    {
      data: {
        createdAt: now,
        height: 4,
        name: 'Kitchen Bed',
        rotation: 0,
        updatedAt: now,
        width: 8,
        x: 1,
        y: 1,
      },
      path: `gardens/${defaultGardenId}/plots/kitchen-bed`,
    },
    {
      data: {
        createdAt: now,
        height: 3,
        name: 'Cut Flower Strip',
        rotation: 0,
        updatedAt: now,
        width: 14,
        x: 1,
        y: 6,
      },
      path: `gardens/${defaultGardenId}/plots/cut-flower-strip`,
    },
    {
      data: {
        createdAt: now,
        height: 5,
        name: 'Herb Corner',
        rotation: 0,
        updatedAt: now,
        width: 5,
        x: 11,
        y: 1,
      },
      path: `gardens/${defaultGardenId}/plots/herb-corner`,
    },
  ];
}

function encodeDocumentPath(documentPath) {
  return documentPath.split('/').map(encodeURIComponent).join('/');
}

async function upsertFirestoreDocument(session, documentPath, data) {
  await fetchJson(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${encodeDocumentPath(documentPath)}`,
    {
      accessToken: session.accessToken,
      body: {
        fields: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]),
        ),
      },
      method: 'PATCH',
    },
  );
}

async function seedFirestore(session, uid, email) {
  const documents = buildSeedDocuments(uid, email);

  for (const document of documents) {
    await upsertFirestoreDocument(session, document.path, document.data);
  }

  return documents.map((document) => document.path);
}

async function main() {
  const session = await getCliSession();
  const authConfig = await ensureProjectAuthConfig(session);
  const apiKey = authConfig.config.client?.apiKey;

  if (!apiKey) {
    throw new Error('Firebase Auth config did not expose a client API key.');
  }

  const authUser = await ensureAuthUser(session, apiKey, session.email);
  const seededPaths = await seedFirestore(session, authUser.uid, authUser.email);

  console.log(
    JSON.stringify(
      {
        authConfigChanged: authConfig.changed,
        authUserCreated: authUser.created,
        authorizedDomains: authConfig.config.authorizedDomains,
        emailLinkEnabled:
          authConfig.config.signIn?.email?.enabled === true &&
          authConfig.config.signIn?.email?.passwordRequired !== true,
        gardenId: defaultGardenId,
        projectId,
        seededPaths,
        uid: authUser.uid,
        userEmail: authUser.email,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Unknown Firebase setup error.',
  );
  process.exitCode = 1;
});
