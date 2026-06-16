# Evercookie persistence techniques

This document explains the storage and cache techniques ubercookie teaches. The
scope is intentionally narrow: browser state that can hold, echo, or respawn a
random id.

Prior art worth reading: Samy Kamkar's
[evercookie](https://github.com/samyk/evercookie). Modern browsers have reduced
the cross-site versions of many tricks with storage and cache partitioning, but
first-party persistence is still useful to understand.

---

## The evercookie idea

No single storage location is hard to clear. The trick is **redundancy**: write
the same id to many places, and on each visit read them all and rewrite the id
back everywhere. Clearing one store is undone by the survivors. ubercookie's
orchestrator (`frontend/src/ubercookie/index.js`) is exactly this: *read-all →
consensus → respawn*.

The practical defense is to clear all site state at once, including cached files,
not just cookies.

---

## Client-side, script-accessible storage

### Cookies (baseline) — implemented
- **Mechanism**: `document.cookie = 'uid=abc; max-age=...'`. Sent automatically
  on same-site requests. Small, visible, and easy to delete.
- **Tracking use**: the classic persistent identifier.
- **Mitigations**: cookie clearing, `SameSite`, third-party-cookie blocking, and
  browser/site-data controls.

### localStorage — implemented
- **Mechanism**: same-origin key/value storage that persists across browser
  restarts and is not automatically sent with requests.
- **Tracking use**: store the id client-side, read it back, and report it to the
  server.
- **Mitigations**: requires JavaScript; visible in DevTools; cleared by site-data
  controls.

### sessionStorage — implemented
- **Mechanism**: tab-scoped key/value storage, cleared when the tab closes.
- **Tracking use**: short-lived redundancy during a browsing session.
- **Mitigations**: closing the tab clears it.

### IndexedDB — implemented
- **Mechanism**: asynchronous same-origin database storage.
- **Tracking use**: a durable store that many manual cookie-clearing attempts
  miss.
- **Mitigations**: clear site data; storage partitioning limits cross-site reuse.

### Cache API (`window.caches`) — implemented
- **Mechanism**: named request/response caches controlled from JavaScript.
- **Tracking use**: store the id as a synthetic `Response`, separate from cookies
  and Web Storage.
- **Mitigations**: clear cached files or site data; storage/cache partitioning
  limits cross-site reuse.

### window.name — implemented
- **Mechanism**: a writable per-tab string that survives same-tab navigations.
- **Tracking use**: one more redundant place to carry an id inside a tab.
- **Mitigations**: closing the tab clears it; modern browsers restrict
  cross-origin `window.name` behavior.

### Origin Private File System (OPFS) — implemented
- **Mechanism**: `navigator.storage.getDirectory()` exposes a persistent,
  sandboxed filesystem private to the origin. ubercookie stores the id in a file.
- **Tracking use**: durable same-origin storage that is easy to miss during
  manual cleanup.
- **Mitigations**: clear site data; browser support varies.

### Service Worker + Cache — implemented
- **Mechanism**: a background script stores the id in its own Cache Storage and
  can answer messages from the page.
- **Tracking use**: a storage layer that is separate from the page's direct
  storage APIs and can re-seed other vectors.
- **Mitigations**: unregister service workers or clear site data.

### Persistent-storage hardening — applied
Not a vector itself: the page calls `navigator.storage.persist()` to ask the
browser to make this origin's storage less likely to be automatically evicted
under storage pressure. Users can still clear it manually.

---

## Server-assisted storage and cache vectors

### HttpOnly cookie — implemented
- **Mechanism**: the server sets `Set-Cookie: gid=...; HttpOnly`. JavaScript
  cannot read it, but the browser still sends it on requests.
- **Tracking use**: the server can recover the id even when `document.cookie`
  appears empty to page JavaScript.
- **Mitigations**: clear cookies or site data.

### HTTP cache supercookie (embedded-id resource) — implemented
- **Mechanism**: `/api/cache-id.js` returns JavaScript with the id baked into the
  body and `Cache-Control: public, max-age=31536000, immutable`.
- **Tracking use**: the browser keeps serving the old cached file, including the
  old id, until cached files are cleared.
- **Mitigations**: clear cached files; cache partitioning limits cross-site
  reuse.

### ETag supercookie — implemented
- **Mechanism**: the server returns `ETag: "<id>"` with `Cache-Control:
  no-cache`. The browser stores it and sends it back in `If-None-Match` on
  revalidation.
- **Tracking use**: the id comes back through HTTP cache validation, without
  cookies or JavaScript-readable storage.
- **Mitigations**: clear cached files; privacy tools can strip validators; cache
  partitioning limits cross-site reuse.

### Last-Modified supercookie — implemented
- **Mechanism**: the server stamps a `Last-Modified` date on a cached resource;
  the browser echoes it back via `If-Modified-Since`.
- **Tracking use**: the date encodes a 32-bit token that the server maps back to
  the full id.
- **Mitigations**: clear cached files; privacy tools can strip validators; cache
  partitioning limits cross-site reuse.

---

## Future state-based vector

### HSTS supercookie — possible future work
HSTS fits this project because it is still an evercookie-style stored-state
trick: the browser remembers per-host HTTPS upgrade state, and a site can encode
bits across controlled subdomains.

- **Mechanism**: `Strict-Transport-Security` tells the browser to always use
  HTTPS for a host. A demo can use many subdomains (`bit0.example`, `bit1.example`,
  and so on) as a bit vector.
- **Write**: load HTTPS resources from selected subdomains so their HSTS state is
  stored.
- **Read**: request the fixed subdomain set over HTTP and observe which ones the
  browser upgrades to HTTPS.
- **Requirements**: a real domain, controlled subdomains, and a wildcard HTTPS
  certificate.
- **Mitigations**: clear site/security state; browser restrictions and
  partitioning reduce cross-site abuse.

This is a reasonable future direction for ubercookie. It teaches the same lesson
as the current vectors: identity can be encoded in browser-maintained state, and
clearing only cookies is not enough.

---

## Comparison summary

| Mechanism | Persistence | JavaScript required? | Cleared by |
|---|---|---|---|
| Cookies | configurable | write/read here: yes | cookies / site data |
| localStorage | indefinite | yes | site data |
| sessionStorage | tab lifetime | yes | tab close |
| IndexedDB | indefinite | yes | site data |
| Cache API | until cleared | yes | cached files / site data |
| window.name | tab lifetime | yes | tab close |
| OPFS | indefinite | yes | site data |
| Service Worker + Cache | until cleared | yes | service worker / site data |
| HttpOnly cookie | configurable | no | cookies / site data |
| HTTP cache embedded id | cache TTL | no for storage, yes here for reading | cached files |
| ETag | cache TTL | no | cached files |
| Last-Modified | cache TTL | no | cached files |
| HSTS | browser-managed state | partial | site/security state |

---

## Mitigations

1. Clear browsing data for the site, including cached files.
2. Use private browsing when you want storage discarded on close.
3. Prefer browsers and modes that partition storage, caches, and related browser
   state by top-level site.
4. Use tracker blockers to prevent third-party tracking code from running.
5. Remember that clearing only cookies is incomplete; redundant storage is the
   point of the evercookie pattern.
