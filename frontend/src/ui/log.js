// A tiny in-memory ledger of what the lab does this session. The UI reads it to
// render the "Lab events" panel, so visitors can watch the tracking happen —
// reads, re-seeds, manual clears, and whether anything survived "Forget me".
//
// It is deliberately session-scoped (no storage): reloading the page starts a
// fresh log, which keeps it honest about what *this* page load actually did.

const entries = [];

/**
 * Append an event. Kind tints the row: 'info' (default), 'ok', 'warn'.
 * @returns {Array} the live entries array (oldest first).
 */
export function logEvent(message, kind = 'info') {
  entries.push({ time: new Date(), message, kind });
  return entries;
}

/** All events so far, oldest first. The panel renders them newest-first. */
export function logEvents() {
  return entries;
}
