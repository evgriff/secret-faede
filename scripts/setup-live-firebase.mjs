import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');

const projectId = process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID is required.');
}

const defaultAuthorizedDomains = [
  '127.0.0.1',
  'localhost',
  `${projectId}.firebaseapp.com`,
  `${projectId}.web.app`,
];

function uniqueInOrder(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseAdditionalDomains(value) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
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

  if (!account?.tokens?.refresh_token) {
    throw new Error(
      'Firebase CLI login is required. Run `firebase login` first.',
    );
  }

  const token = await auth.getAccessToken(account.tokens.refresh_token, []);

  if (!token?.access_token) {
    throw new Error(
      'Unable to get an access token from the Firebase CLI session.',
    );
  }

  return {
    accessToken: token.access_token,
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
            passwordRequired: true,
          },
        },
      },
      method: 'PATCH',
    },
  );
}

async function main() {
  const session = await getCliSession();
  const currentConfig = await getProjectAuthConfig(session);
  const authorizedDomains = uniqueInOrder([
    ...(currentConfig.authorizedDomains ?? []),
    ...defaultAuthorizedDomains,
    ...parseAdditionalDomains(process.env.FIREBASE_AUTH_DOMAINS),
  ]);
  const updatedConfig = await updateProjectAuthConfig(
    session,
    authorizedDomains,
  );

  console.log(
    JSON.stringify(
      {
        authorizedDomains: updatedConfig.authorizedDomains ?? authorizedDomains,
        passwordAuthEnabled:
          updatedConfig.signIn?.email?.enabled === true &&
          updatedConfig.signIn?.email?.passwordRequired === true,
        projectId,
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
