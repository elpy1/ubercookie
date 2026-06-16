// Every storage vector the ubercookie plants its id into, in display order:
// client-side stores first, then the server-backed ones.
import cookie from './vectors/cookie.js';
import localStorageVector from './vectors/localStorage.js';
import sessionStorageVector from './vectors/sessionStorage.js';
import indexedDBVector from './vectors/indexedDB.js';
import cacheApi from './vectors/cacheApi.js';
import windowName from './vectors/windowName.js';
import opfs from './vectors/opfs.js';
import serviceWorker from './vectors/serviceWorker.js';
import serverCookie from './vectors/serverCookie.js';
import etag from './vectors/etag.js';
import lastModified from './vectors/lastModified.js';
import httpCache from './vectors/httpCache.js';

export const vectors = [
  cookie,
  localStorageVector,
  sessionStorageVector,
  indexedDBVector,
  cacheApi,
  windowName,
  opfs,
  serviceWorker,
  serverCookie,
  etag,
  lastModified,
  httpCache,
];

export function getVector(id) {
  return vectors.find((v) => v.id === id) || null;
}

/** Human-readable label for a vector id, falling back to the id itself. */
export function labelFor(id) {
  const vec = getVector(id);
  return vec ? vec.label : id;
}
