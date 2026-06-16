import { SET_HEADER } from '../constants.js';

// The ETag supercookie. The server stamps the id into an ETag header on a tiny
// cached resource. The browser stores it and, on every revisit, automatically
// sends it back in If-None-Match — so the server re-identifies the browser with
// no cookie and no JavaScript storage at all. It lives in the HTTP cache, so we
// cannot delete it from JavaScript: only clearing the browser cache removes it.
export default {
  id: 'etag',
  label: 'ETag supercookie',
  kind: 'server',
  jsRequired: false,
  clearable: false,
  blurb:
    'The server hides the id in an ETag on a cached resource; the browser echoes it back via ' +
    'If-None-Match on every revisit. No cookie, no storage API — and only a cache wipe clears it.',

  // Reading triggers the browser to revalidate its cached copy, sending
  // If-None-Match; the server tells us what it recovered.
  async read() {
    try {
      const res = await fetch('/api/etag-id', { credentials: 'same-origin' });
      const data = await res.json();
      return data.recovered || null;
    } catch {
      return null;
    }
  },

  // Writing forces a fresh server hit (bypassing the cached copy) whose response
  // carries ETag = value; the browser then stores that for next time.
  async write(value) {
    try {
      const res = await fetch('/api/etag-id', {
        credentials: 'same-origin',
        cache: 'reload',
        headers: { [SET_HEADER]: value },
      });
      return res.ok;
    } catch {
      /* ignore */
      return false;
    }
  },

  // Not removable from JavaScript — see blurb.
  async clear() {},
};
