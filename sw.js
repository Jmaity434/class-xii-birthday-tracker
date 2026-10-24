// Service Worker for Class XII Birthday Tracker
const CACHE_NAME = 'bday-tracker-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});

// Handle push events if triggered from server or timer
self.addEventListener('push', (event) => {
  let data = { title: '🎉 শুভ জন্মদিন!', body: 'আজকে বন্ধুদের জন্মদিন!' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {}

  const options = {
    body: data.body,
    icon: 'favicon.svg',
    badge: 'favicon.svg',
    vibrate: [200, 100, 200],
    data: { url: './index.html' }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});
