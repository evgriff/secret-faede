import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export async function createFirebaseCliAuthClient(projectId) {
  return createRestAuth(projectId, await getFirebaseCliAccessToken());
}

function createRestAuth(projectId, accessToken) {
  return {
    async getUserByEmail(email) {
      const payload = await fetchIdentityToolkitJson(
        projectId,
        'accounts:lookup',
        accessToken,
        { email: [email] },
      );
      const user = payload.users?.[0];

      if (!user) {
        const error = new Error('missing');
        error.code = 'auth/user-not-found';
        throw error;
      }

      return mapRestUser(user);
    },
    async listUsers(maxResults = 1000, pageToken) {
      const searchParams = new URLSearchParams({
        maxResults: String(maxResults),
        ...(pageToken ? { pageToken } : {}),
      });
      const payload = await fetchIdentityToolkitJson(
        projectId,
        `accounts:batchGet?${searchParams.toString()}`,
        accessToken,
        null,
        'GET',
      );

      return {
        pageToken: payload.nextPageToken,
        users: (payload.users ?? []).map(mapRestUser),
      };
    },
    async setCustomUserClaims(uid, claims) {
      await fetchIdentityToolkitJson(
        projectId,
        'accounts:update',
        accessToken,
        {
          customAttributes: JSON.stringify(claims ?? {}),
          localId: uid,
        },
      );
    },
  };
}

async function fetchIdentityToolkitJson(
  projectId,
  method,
  accessToken,
  body,
  httpMethod = 'POST',
) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/${method}`,
    {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: httpMethod,
    },
  );
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      `Identity Toolkit request failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

function mapRestUser(user) {
  return {
    customClaims: parseCustomAttributes(user.customAttributes),
    email: user.email ?? null,
    uid: user.localId,
  };
}

function parseCustomAttributes(value) {
  if (!value) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(value);

    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch {
    return {};
  }
}

async function getFirebaseCliAccessToken() {
  const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
  const firebaseAuth = require('firebase-tools/lib/auth');
  const account = firebaseAuth.getGlobalDefaultAccount();
  const scopes = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase',
  ];

  if (!account?.tokens?.refresh_token) {
    throw new Error(
      'Firebase CLI login is required. Run `firebase login` or set GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }

  const token = await firebaseAuth.getAccessToken(
    account.tokens.refresh_token,
    scopes,
  );

  if (!token?.access_token) {
    throw new Error('Unable to get an access token from Firebase CLI.');
  }

  return token.access_token;
}
