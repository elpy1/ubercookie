import { WINDOW_NAME_PREFIX } from '../constants.js';

// window.name is a writable string that survives same-tab navigations — even
// across origins — until the tab is closed. Historically abused to smuggle an id
// between sites in the same tab. We namespace our value so we don't clobber any
// legitimate use of window.name.
export default {
  id: 'windowName',
  label: 'window.name',
  kind: 'client',
  jsRequired: true,
  clearable: true,
  blurb:
    'A per-tab string that persists across navigations, even cross-origin, until the tab closes. ' +
    'An old trick for carrying an id between pages without any storage API.',

  async read() {
    const name = window.name || '';
    return name.startsWith(WINDOW_NAME_PREFIX) ? name.slice(WINDOW_NAME_PREFIX.length) : null;
  },

  async write(value) {
    window.name = WINDOW_NAME_PREFIX + value;
    return true;
  },

  async clear() {
    if ((window.name || '').startsWith(WINDOW_NAME_PREFIX)) window.name = '';
  },
};
