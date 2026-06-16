import { STORAGE_KEY } from '../constants.js';

// Web Storage. ~5–10 MB, persists indefinitely, NOT auto-sent to the server
// (better "privacy optics") and survives a cookie clear. Visible/deletable in
// DevTools → Application → Local Storage.
export default {
  id: 'localStorage',
  label: 'localStorage',
  kind: 'client',
  jsRequired: true,
  clearable: true,
  blurb:
    'Synchronous key/value store that persists across sessions and survives cookie clears. ' +
    'Not sent automatically with requests, so it draws less attention than a cookie.',

  async read() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null; // private mode / disabled storage
    }
  },

  async write(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
      return true;
    } catch {
      /* ignore quota / disabled */
      return false;
    }
  },

  async clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};
