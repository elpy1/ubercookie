import { SET_HEADER } from '../constants.js';

// The coarser cousin of the ETag supercookie. Instead of an ETag, the server
// stamps the id into the `Last-Modified` date of a cached resource; the browser
// then echoes it back via `If-Modified-Since` on every revisit. A date only
// carries ~32 bits, so the server maps the id to a token and looks the full id
// back up — meaning (unlike ETag) it can't reconstruct the id if the server has
// already forgotten you. Like the other cache vectors, only a cache wipe clears
// it from the browser.
export default {
  id: 'lastModified',
  label: 'Last-Modified supercookie',
  kind: 'server',
  jsRequired: false,
  clearable: false,
  blurb:
    'The server hides you in the Last-Modified date of a cached resource; the browser echoes it ' +
    'back via If-Modified-Since. Coarser than the ETag trick, but the same idea — and a cache wipe ' +
    'is the only way to clear it.',

  async read() {
    try {
      const res = await fetch('/api/lastmod-id', { credentials: 'same-origin' });
      const data = await res.json();
      return data.recovered || null;
    } catch {
      return null;
    }
  },

  async write(value) {
    try {
      const res = await fetch('/api/lastmod-id', {
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

  // Not removable from JavaScript — lives in the HTTP cache.
  async clear() {},
};
