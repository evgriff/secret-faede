/* global firebase, importScripts */
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
      data: payload.data || {},
      icon: '/pwa-192x192.png',
      tag: payload.data?.type || 'garden-alert',
    });
  });
}
