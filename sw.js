// Service Worker for Class XII Birthday Tracker
const CACHE_NAME = 'bday-tracker-v2';

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

// Handle Web Push events (Sent from midnight automation or server)
self.addEventListener('push', (event) => {
  let data = {
    title: '🎉 আজ বন্ধুদের জন্মদিন! 🎂',
    body: 'Class XII-এর বন্ধুদের জন্মদিনের শুভেচ্ছা জানাতে এখনই ক্লিক করুন!'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data.title = parsed.title || data.title;
      data.body = parsed.body || data.body;
      if (parsed.icon) data.icon = parsed.icon;
      if (parsed.url) data.url = parsed.url;
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'favicon.svg',
    badge: 'favicon.svg',
    vibrate: [300, 150, 300, 150, 450],
    data: { url: data.url || './index.html' },
    tag: 'class-xii-midnight-birthday',
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Periodic Background Sync (For supported Android & Chrome devices)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'midnight-birthday-check') {
    event.waitUntil(
      self.registration.showNotification('🎉 আজকের জন্মদিন ট্র্যাকার 🎂', {
        body: 'আজকের সহপাঠী বন্ধুদের জন্মদিন দেখতে ট্র্যাকার খুলুন!',
        icon: 'favicon.svg',
        badge: 'favicon.svg',
        data: { url: './index.html' }
      })
    );
  }
});
