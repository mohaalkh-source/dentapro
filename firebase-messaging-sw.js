/* Firebase Cloud Messaging service worker for background notifications. */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDVVEzXPlfJAD7NSV0tGHzzsx8LiyK2i4w',
  authDomain: 'dentapro-db2f6.firebaseapp.com',
  projectId: 'dentapro-db2f6',
  storageBucket: 'dentapro-db2f6.firebasestorage.app',
  messagingSenderId: '834989089132',
  appId: '1:834989089132:web:91172f8e00c616fa291349',
  measurementId: 'G-HTL7R7C59'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title = notification.title || 'DentaPro';
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/favicon.ico',
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.link;
  const url = target && /^https:\/\//i.test(target) ? target : self.location.origin + '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
