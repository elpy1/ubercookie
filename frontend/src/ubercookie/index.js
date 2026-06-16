// The ubercookie orchestrator.
//
// The whole trick in four steps:
//   1. READ     every vector in parallel.
//   2. CONSENSUS pick the id most vectors agree on (or none, on a first visit).
//   3. REPORT   tell the server; it mints a fresh id if we had none, and records
//               the visit + sets the HttpOnly cookie.
//   4. RESPAWN  write that one id back into every writable vector that lacks it.
//
// Because step 4 re-seeds the survivors, clearing any single vector (or even all
// your cookies) just gets silently refilled from the others on the next visit.

import { vectors, getVector } from './registry.js';
import { requestPersistence } from './persistence.js';

/**
 * Run a full survey: read all vectors, resolve the id, respawn, report.
 * @returns {Promise<{id: string, visit: object, vectors: object[], persistence: object}>}
 */
export async function survey() {
  // Ask the browser to make our storage un-evictable; independent of the reads.
  const persistencePromise = requestPersistence();

  // 1. READ everything at once.
  const reads = await Promise.all(
    vectors.map(async (vector) => {
      let before = null;
      let error = null;
      try {
        before = await vector.read();
      } catch (e) {
        error = String(e);
      }
      return { vector, before, error };
    }),
  );

  // 2. CONSENSUS across whatever the vectors reported.
  const winner = consensus(reads.map((r) => r.before));

  // 3. REPORT to the server (it mints if winner is null, sets the cookie, logs).
  const recoveredFrom = reads.filter((r) => r.before).map((r) => r.vector.id);
  const visit = await reportVisit(winner, recoveredFrom);
  const id = visit.id;

  // 4. RESPAWN: rewrite the canonical id into every vector that doesn't have it.
  const results = await Promise.all(
    reads.map(async (r) => {
      const present = r.before != null;
      const had = r.before === id;
      let respawned = false;
      if (!had) {
        try {
          respawned = (await r.vector.write(id)) !== false;
        } catch {
          respawned = false;
        }
      }
      return describe(r.vector, { before: r.before, present, had, respawned, error: r.error });
    }),
  );

  const persistence = await persistencePromise;
  return { id, visit, vectors: results, persistence };
}

/** Re-read a single vector's current value (used after a per-vector clear). */
export async function probeVector(vectorId) {
  const vector = getVector(vectorId);
  if (!vector) return null;
  try {
    return await vector.read();
  } catch {
    return null;
  }
}

/** Clear one vector (the per-row "clear" buttons). No-op if not clearable. */
export async function clearVector(vectorId) {
  const vector = getVector(vectorId);
  if (!vector || vector.clearable === false) return;
  try {
    await vector.clear();
  } catch {
    /* ignore */
  }
}

/**
 * The honest "Forget me" button: clear every vector we *can* from JavaScript,
 * then wipe the server's record and cookie. Returns the vectors that cannot be
 * cleared this way (HTTP cache / ETag) so the UI can be straight about it.
 */
export async function forget(id) {
  await Promise.all(
    vectors.map(async (vector) => {
      if (vector.clearable === false) return;
      try {
        await vector.clear();
      } catch {
        /* ignore */
      }
    }),
  );
  try {
    await fetch('/api/forget', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id || null }),
    });
  } catch {
    /* ignore */
  }
  return vectors.filter((v) => v.clearable === false).map((v) => v.label);
}

// --------------------------------------------------------------------------- //

function consensus(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

async function reportVisit(id, recoveredFrom) {
  const res = await fetch('/api/visit', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id || null, recovered_from: recoveredFrom }),
  });
  if (!res.ok) throw new Error(`/api/visit failed: ${res.status}`);
  return res.json();
}

function describe(vector, state) {
  return {
    id: vector.id,
    label: vector.label,
    kind: vector.kind,
    jsRequired: vector.jsRequired,
    clearable: vector.clearable !== false,
    blurb: vector.blurb,
    ...state,
  };
}
