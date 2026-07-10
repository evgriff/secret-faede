import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const LEGACY_CACHE_PREFIXES = [
  'secret-faeries-app-assets',
  'secret-faeries-precache-',
  'workbox-precache',
];
const precacheEntries = self.__WB_MANIFEST;
const PRECACHE_NAME = `secret-faeries-precache-${manifestFingerprint(
  precacheEntries,
)}`;
const precacheUrls = [
  ...new Set(
    precacheEntries.map((entry) =>
      typeof entry === 'string' ? entry : entry.url,
    ),
  ),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then((cache) => cache.addAll(precacheUrls))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== PRECACHE_NAME &&
                LEGACY_CACHE_PREFIXES.some((prefix) =>
                  cacheName.startsWith(prefix),
                ),
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(PRECACHE_NAME);
            await cache.put('/index.html', response.clone());
          }
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeAppUrl(event.notification.data?.link || '/app/today');

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then(async (clientList) => {
        const matchingClient = clientList.find(
          (client) => client.url === targetUrl,
        );
        if (matchingClient) return matchingClient.focus();

        const appClient = clientList.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (appClient && 'navigate' in appClient) {
          const navigated = await appClient.navigate(targetUrl);
          return navigated?.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

if (
  firebaseConfig.apiKey &&
  firebaseConfig.appId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.projectId
) {
  try {
    const messaging = getMessaging(initializeApp(firebaseConfig));
    onBackgroundMessage(messaging, (payload) => {
      const title =
        payload.notification?.title || payload.data?.title || 'Garden alert';
      const body = payload.notification?.body || payload.data?.body || '';
      return self.registration.showNotification(title, {
        body,
        data: {
          ...(payload.data || {}),
          link: safeAppUrl(
            payload.data?.link ||
              payload.fcmOptions?.link ||
              payload.notification?.click_action ||
              '/app/today',
          ),
        },
        icon: '/pwa-192x192.png',
        tag:
          payload.data?.alertId ||
          payload.data?.recommendationId ||
          payload.data?.type ||
          'garden-alert',
      });
    });
  } catch (error) {
    console.error('Unable to initialize background messaging.', error);
  }
}

function safeAppUrl(value) {
  const fallback = new URL('/app/today', self.location.origin).href;
  try {
    const target = new URL(value, self.location.origin);
    return target.origin === self.location.origin ? target.href : fallback;
  } catch {
    return fallback;
  }
}

function manifestFingerprint(entries) {
  const input = entries
    .map((entry) =>
      typeof entry === 'string'
        ? entry
        : `${entry.url}:${entry.revision || 'content-hash'}`,
    )
    .join('|');
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}
