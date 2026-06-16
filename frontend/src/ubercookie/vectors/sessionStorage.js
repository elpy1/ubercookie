import { STORAGE_KEY } from '../constants.js';

// Like localStorage but scoped to the tab — cleared when the tab closes. On its
// own it's only good for session-length tracking, but it adds one more place the
// id has to be wiped from simultaneously.
export default {
  id: 'sessionStorage',
  label: 'sessionStorage',
  kind: 'client',
  jsRequired: true,
  clearable: true,
  blurb:
    'Per-tab storage cleared when the tab closes. Useful only for session-length tracking, ' +
    'but it is one more copy to scrub during a single session.',

  async read() {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },

  async write(value) {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
      return true;
    } catch {
      /* ignore */
      return false;
    }
  },

  async clear() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};
