// digital-grownt frontend/sw.js
const ICON = '/storage/app/public/photos/BCPc6799aTDnlcAtaRZAXzQZ7MBzrLZL0H6DStQv.png';

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = String(data.title || 'Digital-grownt');
  const url = String(data.url || '/user/dashboard.html');
  const options = {
    body: String(data.body || 'You have a new notification'),
    icon: data.icon || ICON,
    badge: data.badge || ICON,
    tag: data.tag || 'digital-grownt-notification',
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction) || String(data.tag || '').startsWith('visitor-'),
    vibrate: [200, 100, 200],
    data: { url },
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      client.postMessage({ type: 'DIGITAL_GROWNT_NOTIFICATION', title, body: options.body, url });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/user/dashboard.html';
  const target = new URL(raw, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin));
      if (existing) {
        return existing.focus().then(() => {
          try {
            return existing.navigate(target);
          } catch (_) {
            return clients.openWindow(target);
          }
        });
      }
      return clients.openWindow(target);
    })
  );
});
