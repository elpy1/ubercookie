// The HttpOnly cookie set by the server. JavaScript on the page CANNOT read it
// (document.cookie won't show it), yet the browser still attaches it to every
// request. To "read" it we have to ask the server what it sees. Writing happens
// server-side in POST /api/visit, so write() here is a no-op.
export default {
  id: 'serverCookie',
  label: 'Server cookie (HttpOnly)',
  kind: 'server',
  jsRequired: false,
  clearable: true,
  blurb:
    'A cookie marked HttpOnly: invisible to JavaScript but sent on every request. ' +
    'We can only learn its value by asking the server (GET /api/whoami).',

  async read() {
    try {
      const res = await fetch('/api/whoami', { credentials: 'same-origin' });
      const data = await res.json();
      return data.cookie || null;
    } catch {
      return null;
    }
  },

  // Set by the server during POST /api/visit.
  async write() {
    return true;
  },

  async clear() {
    try {
      await fetch('/api/clear-cookie', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* ignore */
    }
  },
};
