// ubercookie service worker.
//
// A Service Worker is a background script that keeps running independently of any
// page and can persist data (here, in Cache Storage) plus intercept network
// requests. That makes it both a redundant place to stash the id AND something
// that can re-serve it even while offline. The page talks to it via postMessage.

const CACHE = 'ubercookie-sw';
const KEY = '/__sw_ubercookie_id';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function readId() {
  const cache = await caches.open(CACHE);
  const res = await cache.match(KEY);
  return res ? await res.text() : null;
}

async function writeId(id) {
  const cache = await caches.open(CACHE);
  await cache.put(KEY, new Response(id, { headers: { 'Content-Type': 'text/plain' } }));
}

async function clearId() {
  const cache = await caches.open(CACHE);
  await cache.delete(KEY);
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  if (data.type === 'gc-set' && data.id) {
    event.waitUntil(
      writeId(data.id)
        .then(() => {
          if (port) port.postMessage({ ok: true });
        })
        .catch(() => {
          if (port) port.postMessage({ ok: false });
        }),
    );
  } else if (data.type === 'gc-get') {
    event.waitUntil(
      readId().then((id) => {
        if (port) port.postMessage({ id });
      }),
    );
  } else if (data.type === 'gc-clear') {
    event.waitUntil(
      clearId()
        .then(() => {
          if (port) port.postMessage({ ok: true });
        })
        .catch(() => {
          if (port) port.postMessage({ ok: false });
        }),
    );
  }
});

// Bonus: serve the stored id directly from the SW for the sentinel URL, so it
// works even with no network (offline persistence).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === KEY) {
    event.respondWith(
      readId().then((id) => new Response(id || '', { headers: { 'Content-Type': 'text/plain' } })),
    );
  }
});
