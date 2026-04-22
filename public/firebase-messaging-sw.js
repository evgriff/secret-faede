/* global firebase, importScripts */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.link || '/app/today';

  event.waitUntil(
    clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clientList) => {
        const matchingClient = clientList.find((client) =>
          client.url.includes(targetUrl),
        );

        if (matchingClient) {
          return matchingClient.focus();
        }

        return clients.openWindow(targetUrl);
      }),
  );
});

importScripts(
  'https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js',
);

const config = Object.fromEntries(new URL(self.location.href).searchParams);

if (config.apiKey && config.projectId && config.messagingSenderId) {
  firebase.initializeApp(config);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title =
      payload.notification?.title || payload.data?.title || 'Garden alert';
    const body = payload.notification?.body || payload.data?.body || '';

    self.registration.showNotification(title, {
      body,
      data: {
        ...(payload.data || {}),
        link: payload.data?.link || '/app/today',
      },
      icon: '/pwa-192x192.png',
      tag: payload.data?.type || 'garden-alert',
    });
  });
}
