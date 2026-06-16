import { SET_HEADER } from '../constants.js';

// HTTP-cache supercookie. The server bakes the id into a JavaScript file marked
// `immutable` and cached for a year. The browser then serves that exact file —
// with the old id inside it — on every later visit until the cache is cleared.
// We read it back with `only-if-cached`, which returns the cached copy without
// ever touching the network (and throws if nothing is cached).
export default {
  id: 'httpCache',
  label: 'HTTP cache (embedded-id script)',
  kind: 'server',
  jsRequired: false,
  clearable: false,
  blurb:
    'The id is baked into an "immutable", year-long cached script. Your browser keeps serving the ' +
    'old file (old id and all) on every revisit. Only clearing the browser cache removes it.',

  async read() {
    try {
      const res = await fetch('/api/cache-id.js', { cache: 'only-if-cached', mode: 'same-origin' });
      if (!res.ok) return null;
      const text = await res.text();
      const match = text.match(/__GIGACOOKIE_CACHE_ID\s*=\s*"([0-9a-f]{32})"/);
      return match ? match[1] : null;
    } catch {
      // only-if-cached rejects when there is no cached entry — that just means
      // the vector is empty.
      return null;
    }
  },

  async write(value) {
    try {
      const res = await fetch('/api/cache-id.js', {
        cache: 'reload',
        mode: 'same-origin',
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
