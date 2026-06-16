import './style.css';
import { survey, forget, clearVector } from './ubercookie/index.js';
import { renderApp, renderLoading, renderError } from './ui/dashboard.js';
import { logEvent, logEvents } from './ui/log.js';
import { labelFor } from './ubercookie/registry.js';

const root = document.querySelector('#app');
let lastId = null;
let selectedVectorId = null; // which check the detail panel shows; survives re-renders

const handlers = {
  // Re-run a full survey. After you manually clear a vector in DevTools and hit
  // this, you'll watch it get re-seeded from the survivors.
  onRescan: () => run(),

  // Remember which check the detail panel is showing so it stays put across the
  // re-renders that follow a clear / forget / re-scan.
  onSelectVector: (id) => {
    selectedVectorId = id;
  },

  // Per-vector "clear" buttons: wipe one store, then immediately re-survey so
  // the respawn is visible.
  onClearVector: async (vectorId) => {
    logEvent(`Cleared ${labelFor(vectorId)} by hand.`);
    await clearVector(vectorId);
    await run({ kind: 'cleared-one', vectorId });
  },

  // The honest "Forget me": clear everything reachable from JS + the server
  // record, then re-survey to show, truthfully, what (if anything) survived.
  onForget: async () => {
    logEvent('“Forget me” — wiping every JS-reachable store and the server record.', 'warn');
    renderLoading(root, 'Wiping every vector we can reach…');
    try {
      const oldId = lastId;
      const stubborn = await forget(oldId);
      const result = await survey();
      lastId = result.id;
      const resurrected = Boolean(oldId) && result.id === oldId;
      logSurvey(result);
      logEvent(
        resurrected
          ? 'Survived “Forget me” — id recovered from the HTTP cache / ETag.'
          : 'Forgotten — a brand-new identity was minted.',
        resurrected ? 'warn' : 'ok',
      );
      paint(result, { kind: resurrected ? 'resurrected' : 'forgotten', stubborn, oldId });
    } catch (e) {
      renderError(root, e, handlers);
    }
  },
};

function paint(result, notice) {
  renderApp(root, result, handlers, notice, { selectedVectorId, events: logEvents() });
}

// Translate a finished survey into log entries: what we read, whether we were
// recognised, and how many vectors we silently re-seeded.
function logSurvey(result) {
  const total = result.vectors.length;
  const reseeded = result.vectors.filter((v) => v.respawned).length;
  const held = result.vectors.filter((v) => v.had).length;
  const plural = reseeded === 1 ? '' : 's';
  if (logEvents().length === 0) logEvent('Opened the privacy lab.');
  logEvent(`Read all ${total} storage vectors.`);
  if (result.visit.minted_now) {
    logEvent('No id found anywhere — minted a fresh one.', 'ok');
    if (reseeded) logEvent(`Planted the new id into ${reseeded} vector${plural}.`, 'ok');
  } else {
    logEvent(`Recognised — id already present in ${held} of ${total} vectors.`, 'warn');
    if (reseeded) logEvent(`Re-seeded ${reseeded} vector${plural} that had lost it.`, 'warn');
  }
}

async function run(notice) {
  renderLoading(root);
  try {
    const result = await survey();
    lastId = result.id;
    logSurvey(result);
    if (notice && notice.kind === 'cleared-one') {
      const vec = result.vectors.find((v) => v.id === notice.vectorId);
      if (vec && (vec.respawned || vec.had)) {
        logEvent(`${labelFor(notice.vectorId)} came right back — re-seeded from the survivors.`, 'warn');
      }
    }
    paint(result, notice);
  } catch (e) {
    renderError(root, e, handlers);
  }
}

run();
