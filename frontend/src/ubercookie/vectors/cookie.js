import { COOKIE_KEY, ONE_YEAR } from '../constants.js';

// The classic. A first-party cookie written from JavaScript, sent to the server
// on every request. Trivial to read and delete in DevTools — which is exactly
// why trackers no longer rely on it alone.
export default {
  id: 'cookie',
  label: 'Cookie (document.cookie)',
  kind: 'client',
  jsRequired: true,
  clearable: true,
  blurb:
    'A first-party cookie set from JavaScript. Auto-sent to the server on every request. ' +
    'The baseline tracker — and the easiest one to see and delete.',

  async read() {
    const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_KEY + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  },

  async write(value) {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(value)}; max-age=${ONE_YEAR}; path=/; SameSite=Lax`;
    return true;
  },

  async clear() {
    document.cookie = `${COOKIE_KEY}=; max-age=0; path=/; SameSite=Lax`;
  },
};
