import { CACHE_NAME, CACHE_API_URL } from '../constants.js';

// The Cache API (window.caches) lets a page store arbitrary Request→Response
// pairs in a named cache. It's separate from cookies and Web Storage, survives
// their clearing, and is available in any secure context (HTTPS or localhost) —
// no Service Worker required for this simple use.
function supported() {
  return typeof caches !== 'undefined';
}

export default {
  id: 'cacheApi',
  label: 'Cache API (caches)',
  kind: 'client',
  jsRequired: true,
  clearable: true,
  blurb:
    'A programmable named cache (separate from cookies and Web Storage) where the id is stored ' +
    'as a synthetic Response. Survives clearing the others; needs a secure context.',

  async read() {
    if (!supported()) return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(CACHE_API_URL);
      return response ? (await response.text()) : null;
    } catch {
      return null;
    }
  },

  async write(value) {
    if (!supported()) return false;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(CACHE_API_URL, new Response(value));
      return true;
    } catch {
      /* ignore */
      return false;
    }
  },

  async clear() {
    if (!supported()) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(CACHE_API_URL);
    } catch {
      /* ignore */
    }
  },
};
