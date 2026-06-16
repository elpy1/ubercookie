import { STORAGE_KEY } from '../constants.js';

// IndexedDB: an asynchronous, transactional database in the browser. Overkill
// for a single id, but it's a separate store with its own clear button, so it
// makes the evercookie more redundant. A lot of "I cleared everything!" attempts
// miss this one.
const DB_NAME = 'ubercookie';
const STORE_NAME = 'kv';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = fn(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
  });
}

export default {
  id: 'indexedDB',
  label: 'IndexedDB',
  kind: 'client',
  jsRequired: true,
  clearable: true,
  blurb:
    'A full asynchronous database in the browser. Far more capable than needed for one id, ' +
    'but it is a distinct store many people forget to clear.',

  async read() {
    if (!('indexedDB' in window)) return null;
    try {
      const db = await openDB();
      try {
        const value = await tx(db, 'readonly', (store) => store.get(STORAGE_KEY));
        return value ?? null;
      } finally {
        db.close();
      }
    } catch {
      return null;
    }
  },

  async write(value) {
    if (!('indexedDB' in window)) return false;
    try {
      const db = await openDB();
      try {
        await tx(db, 'readwrite', (store) => store.put(value, STORAGE_KEY));
        return true;
      } finally {
        db.close();
      }
    } catch {
      /* ignore */
      return false;
    }
  },

  async clear() {
    if (!('indexedDB' in window)) return;
    try {
      const db = await openDB();
      try {
        await tx(db, 'readwrite', (store) => store.delete(STORAGE_KEY));
      } finally {
        db.close();
      }
    } catch {
      /* ignore */
    }
  },
};
