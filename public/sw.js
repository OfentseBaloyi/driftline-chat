// Driftline service worker — handles incoming push notifications
// and routes taps back into the app.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: 'Driftline', body: 'You have a new message', conversationId: null }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch (e) {
    // fall back to defaults if payload isn't JSON
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { conversationId: data.conversationId, url: '/' },
    tag: data.conversationId ? `conversation-${data.conversationId}` : undefined,
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const conversationId = event.notification.data?.conversationId

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      // If a tab is already open, focus it and tell the app which chat to open
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          client.postMessage({ type: 'OPEN_CONVERSATION', conversationId })
          return
        }
      }

      // No tab open — launch one, carrying the conversation id in the URL
      const url = conversationId ? `/?conversation=${conversationId}` : '/'
      await self.clients.openWindow(url)
    })()
  )
})