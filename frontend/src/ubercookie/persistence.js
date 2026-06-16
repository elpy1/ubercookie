// Storage hardening: ask the browser to make this origin's storage *persistent*,
// i.e. exempt from automatic eviction when the device is low on space. This is
// not a vector itself (it stores no id) — it makes the IndexedDB, Cache API,
// Service Worker, and OPFS vectors stickier so the browser won't quietly drop
// them under storage pressure.
//
// Browsers grant this differently: Chrome decides via heuristics (site
// engagement, installed PWA, notifications permission) usually with no prompt;
// Firefox may show a prompt. Either way it's fire-and-forget and degrades
// gracefully when unsupported.
export async function requestPersistence() {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
    return { supported: false, persisted: false };
  }
  try {
    // Don't re-prompt if already granted.
    let persisted = await navigator.storage.persisted();
    if (!persisted) {
      persisted = await navigator.storage.persist();
    }
    return { supported: true, persisted };
  } catch {
    return { supported: false, persisted: false };
  }
}
