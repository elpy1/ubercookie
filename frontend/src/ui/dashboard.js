// Renders the awareness dashboard. Pure vanilla DOM — no framework — so the
// page itself stays as inspectable as the tracking code behind it.

import { labelFor } from '../ubercookie/registry.js';

/** Tiny hyperscript helper: h('div', {class:'x'}, child, child) */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function svgIcon(name) {
  const icons = {
    github: {
      viewBox: '0 0 16 16',
      path:
        'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.67 7.67 0 0 1 8 4.58c.68 0 1.36.09 2 .26 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z',
    },
    x: {
      viewBox: '0 0 24 24',
      path:
        'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z',
    },
  };
  const icon = icons[name];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', icon.viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', icon.path);
  svg.append(path);
  return svg;
}

function clear(root) {
  root.replaceChildren();
}

export function renderLoading(root, text = 'Reading every storage vector in your browser…') {
  clear(root);
  root.append(
    h('main', { class: 'wrap' }, h('div', { class: 'loading' }, h('div', { class: 'spinner' }), h('p', {}, text))),
  );
}

export function renderError(root, error, handlers) {
  clear(root);
  root.append(
    h(
      'main',
      { class: 'wrap' },
      h('div', { class: 'card error' }, h('h2', {}, 'Something went wrong'), h('p', {}, String(error)),
        h('button', { class: 'btn', onClick: () => handlers.onRescan() }, 'Try again')),
    ),
  );
}

/**
 * @param view {{ selectedVectorId?: string, events?: object[] }}
 *   selectedVectorId — which check the detail panel shows (survives re-renders)
 *   events           — the session log entries (oldest first)
 */
export function renderApp(root, result, handlers, notice, view = {}) {
  clear(root);
  const events = view.events || [];

  // The "lab": a grid of compact check cards on the left, a sticky detail panel
  // on the right. Selecting a card swaps the panel in place — no full re-render,
  // so clicking around stays cheap and doesn't jump the scroll position.
  const detailAside = h('aside', {
    class: 'card lab-detail',
    id: 'detail',
    role: 'region',
    'aria-label': 'Selected vector detail',
  });
  const cards = result.vectors.map((vec) => vectorCard(vec, select));
  const gridEl = h('div', { class: 'lab-grid' }, ...cards);

  function select(id, opts = {}) {
    const vec = result.vectors.find((v) => v.id === id);
    if (!vec) return;
    if (handlers.onSelectVector) handlers.onSelectVector(id);
    detailAside.replaceChildren(...detailContent(vec, handlers).filter(Boolean));
    for (const card of cards) {
      const on = card.dataset.vector === id;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-pressed', String(on));
    }
    // Move focus into the panel so keyboard / screen-reader users land on the
    // content that just changed — but not on the initial render (it would steal
    // focus on load, and the aside isn't in the DOM yet anyway).
    if (!opts.initial) detailAside.querySelector('.detail-title')?.focus();
  }

  // Initial selection: whatever was open last → first vector still holding the
  // id → just the first vector. So the panel is never empty on load.
  const remembered =
    view.selectedVectorId && result.vectors.some((v) => v.id === view.selectedVectorId)
      ? view.selectedVectorId
      : (result.vectors.find((v) => v.had || v.respawned) || result.vectors[0]).id;
  select(remembered, { initial: true });

  root.append(
    h(
      'main',
      { class: 'wrap' },
      header(),
      notice ? noticeBanner(notice, result) : null,
      h('div', { class: 'topgrid' }, identityPanel(result), logPanel(events)),
      sectionTitle('Where your id is hiding', `${countPlanted(result)} of ${result.vectors.length} vectors now hold it`),
      persistNote(result.persistence),
      h('section', { class: 'lab', id: 'vectors' }, gridEl, detailAside),
      actions(handlers),
      explainer(),
      footer(),
    ),
  );
}

// --------------------------------------------------------------------------- //

function header() {
  return h(
    'header',
    { class: 'masthead' },
    h(
      'nav',
      { class: 'site-nav', 'aria-label': 'Site' },
      h('span', { class: 'brand' }, h('span', { class: 'brand-icon', 'aria-hidden': 'true' }, '🍪'), 'ubercookie'),
      h(
        'div',
        { class: 'social-links' },
        profileLink('GitHub', 'https://github.com/elpy1', svgIcon('github')),
        profileLink('X', 'https://x.com/itselpy', svgIcon('x')),
      ),
    ),
    h('h1', {}, 'Your persistent browser id'),
    h('p', { class: 'tagline' }, 'A live demonstration of how websites recognise you — even after you "clear everything".'),
    h(
      'aside',
      { class: 'disclaimer' },
      h('strong', {}, 'This page intentionally tracks this browser. '),
      'It is an educational tool. The server stores only this random id, visit counts, and recovery sources. No third-party requests are made, and the ',
      h('em', {}, 'Forget me'),
      ' button wipes everything it can.',
    ),
  );
}

function profileLink(label, href, icon) {
  return h(
    'a',
    {
      class: 'social-link',
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: label,
      'aria-label': `${label} profile`,
    },
    icon,
  );
}

function identityPanel(result) {
  const v = result.visit;
  const seenBefore = !v.minted_now;
  const headline = v.minted_now
    ? 'New here — we just minted a fresh id for you.'
    : `Recognised. We've seen this browser ${v.visit_count}× since ${formatDate(v.first_seen)}.`;

  const recovered = (v.recovered_from || []).filter(Boolean);
  return h(
    'section',
    { class: 'identity ' + (seenBefore ? 'known' : 'fresh') },
    h('div', { class: 'identity-label' }, 'Your ubercookie id'),
    h(
      'div',
      { class: 'identity-id-row' },
      h('div', { class: 'identity-id', title: result.id }, result.id),
      copyButton(result.id, { label: 'Copy id' }),
    ),
    h('div', { class: 'identity-headline' }, headline),
    recovered.length
      ? h(
          'div',
          { class: 'identity-recovered' },
          'Re-identified this visit from: ',
          ...recovered.map((id) => h('span', { class: 'pill pill-src' }, labelFor(id))),
        )
      : null,
  );
}

function vectorCard(vec, onSelect) {
  const status = statusOf(vec);
  const risk = riskOf(vec);
  const noJs = vec.jsRequired === false ? ', works without JavaScript' : '';
  return h(
    'article',
    {
      class: 'card vector',
      dataset: { vector: vec.id },
      role: 'button',
      tabindex: '0',
      'aria-pressed': 'false',
      'aria-controls': 'detail',
      // Concise name so AT doesn't read the flattened card (incl. the raw id value).
      'aria-label': `${vec.label}: ${status.pill}, ${risk.label}, ${vec.kind}${noJs}.`,
      onClick: () => onSelect(vec.id),
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(vec.id);
        }
      },
    },
    h(
      'div',
      { class: 'vector-head' },
      h('h3', {}, vec.label),
      h('span', { class: 'status-pill status-' + status.tone, title: status.text }, status.pill),
    ),
    h('p', { class: 'vector-summary' }, cardSummary(vec)),
    h('div', { class: 'vector-value', title: vec.before || '' }, 'found: ', h('code', {}, vec.before || '—')),
  );
}

function cardSummary(vec) {
  const summaries = {
    cookie: 'First-party JavaScript cookie written for this origin.',
    localStorage: 'Profile written to same-origin localStorage.',
    sessionStorage: 'Profile written to tab-scoped sessionStorage.',
    indexedDB: 'Profile written to an IndexedDB object store.',
    cacheApi: 'Identifier stored as a synthetic Cache API response.',
    windowName: 'Identifier carried in this tab’s window.name value.',
    opfs: 'Identifier written to the origin-private file system.',
    serviceWorker: 'Service worker stores the id in its own cache.',
    serverCookie: 'HttpOnly cookie set by the server and hidden from JavaScript.',
    etag: 'HTTP validator echoes the id back through If-None-Match.',
    lastModified: 'HTTP date validator maps back to the stored id.',
    httpCache: 'Immutable cached script contains the identifier.',
  };
  return summaries[vec.id] || vec.blurb;
}

// Selected-vector detail panel. Everything here is derived from data the vector
// already carries — no new checks, just a richer view of the survey result.
function detailContent(vec, handlers) {
  const status = statusOf(vec);
  const risk = riskOf(vec);
  return [
    h(
      'div',
      { class: 'detail-head' },
      h('span', { class: 'risk risk-' + risk.level }, risk.label),
      h('span', { class: 'pill pill-' + vec.kind }, vec.kind === 'server' ? 'server' : 'client'),
      vec.jsRequired === false ? h('span', { class: 'pill pill-nojs' }, 'no-JS') : null,
    ),
    h('h3', { class: 'detail-title', tabindex: '-1' }, vec.label),
    h('p', { class: 'detail-blurb' }, vec.blurb),
    h(
      'dl',
      { class: 'detail-dl' },
      dRow('Persistence', persistenceOf(vec)),
      dRow('JavaScript', vec.jsRequired === false ? 'Not required' : 'Required'),
      dRow('Status', status.text),
    ),
    h(
      'div',
      { class: 'detail-value' },
      h('span', { class: 'detail-value-label' }, 'Value found'),
      h('div', { class: 'detail-value-row' }, h('code', {}, vec.before || '—'), vec.before ? copyButton(vec.before) : null),
    ),
    vec.clearable
      ? h(
          'div',
          { class: 'detail-callout' },
          h('button', { class: 'btn btn-sm', onClick: () => handlers.onClearVector(vec.id) }, 'Clear this vector'),
          h('p', { class: 'muted' }, 'Clearing it alone is futile — the next scan re-seeds it from the survivors.'),
        )
      : h(
          'div',
          { class: 'detail-callout warn' },
          h('strong', {}, 'Survives a “clear”'),
          h('p', { class: 'muted' }, 'Lives in the browser HTTP cache. JavaScript cannot delete it — only clearing cached files removes it.'),
        ),
  ];
}

function dRow(key, value) {
  return [h('dt', {}, key), h('dd', {}, value)];
}

// Risk is derived, not measured: anything JavaScript can't delete is the worst
// (a real supercookie), server-backed and persistent stores are middling, and
// the volatile client stores that die on their own are mild.
function riskOf(vec) {
  if (vec.clearable === false) return { level: 'high', label: 'high risk' };
  if (vec.id === 'sessionStorage' || vec.id === 'windowName') return { level: 'low', label: 'low risk' };
  return { level: 'medium', label: 'medium risk' };
}

function persistenceOf(vec) {
  if (vec.clearable === false) return 'Until the browser cache is cleared';
  if (vec.id === 'sessionStorage') return 'Until this tab is closed';
  if (vec.id === 'windowName') return 'Until you navigate away';
  if (vec.kind === 'server') return 'Until the server record / cookie is cleared';
  return 'Until explicitly cleared';
}

function statusOf(vec) {
  if (vec.error) return { tone: 'error', text: 'error reading', pill: 'error' };
  if (vec.had) return { tone: 'held', text: 'already held your id', pill: 'present' };
  if (vec.present) return { tone: 'seeded', text: 'held a different id — overwritten', pill: 're-seeded' };
  if (vec.respawned) return { tone: 'seeded', text: 'was empty → re-seeded just now', pill: 're-seeded' };
  return { tone: 'empty', text: 'empty', pill: 'empty' };
}

function logPanel(events) {
  const items = [...events].reverse(); // newest first
  return h(
    'section',
    { class: 'card log', id: 'events' },
    h(
      'div',
      { class: 'log-head' },
      h('h2', {}, 'Lab events'),
      h('span', { class: 'muted' }, `${events.length} event${events.length === 1 ? '' : 's'}`),
    ),
    items.length
      ? h('ol', { class: 'log-list' }, ...items.map(logRow))
      : h('p', { class: 'muted log-empty' }, 'No events yet — interact with the lab to see what it does.'),
  );
}

function logRow(e) {
  return h(
    'li',
    { class: 'log-item log-' + (e.kind || 'info') },
    h('time', {}, formatTime(e.time)),
    h('span', { class: 'log-msg' }, e.message),
  );
}

function copyButton(text, opts = {}) {
  const label = opts.label || 'Copy';
  const btn = h('button', { class: 'copy-btn', type: 'button', title: 'Copy to clipboard' }, label);
  btn.addEventListener('click', async (ev) => {
    ev.stopPropagation(); // don't also trigger a card selection
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('copied');
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = label;
      }, 1200);
    } catch {
      // Insecure context (no navigator.clipboard) or denied permission: tell the
      // user instead of failing silently, so they can select-and-copy by hand.
      btn.classList.add('copy-failed');
      btn.textContent = 'Copy failed';
      btn.title = 'Could not copy — select the text and copy manually';
      setTimeout(() => {
        btn.classList.remove('copy-failed');
        btn.textContent = label;
        btn.title = 'Copy to clipboard';
      }, 1400);
    }
  });
  return btn;
}

function actions(handlers) {
  return h(
    'section',
    { class: 'actions' },
    h('button', { class: 'btn', onClick: () => handlers.onRescan() }, 'Re-scan'),
    h('button', { class: 'btn btn-danger', onClick: () => handlers.onForget() }, 'Forget me'),
    h('p', { class: 'actions-hint' }, 'Tip: open DevTools, delete some of these stores yourself, then hit Re-scan.'),
  );
}

function noticeBanner(notice, result) {
  if (notice.kind === 'cleared-one') {
    const label = labelFor(notice.vectorId);
    const vec = result.vectors.find((v) => v.id === notice.vectorId);
    const cameBack = vec && (vec.respawned || vec.had);
    return banner(
      cameBack ? 'warn' : 'info',
      cameBack ? `“${label}” came right back` : `Cleared “${label}”`,
      cameBack
        ? `You cleared ${label}, but the survey re-seeded it from the other vectors. That's the evercookie effect — one survivor refills the rest.`
        : `Cleared ${label}.`,
    );
  }
  if (notice.kind === 'resurrected') {
    return banner(
      'warn',
      'Your id survived “Forget me”',
      'We wiped every JavaScript-reachable store and deleted the server record — yet the same id came back, recovered from the HTTP cache / ETag. Those live in your browser cache, which only you can clear. See "How to actually protect yourself" below.',
    );
  }
  if (notice.kind === 'forgotten') {
    return banner(
      'ok',
      'Forgotten — you got a brand-new identity',
      'Everything cleared, and nothing survived to respawn the old id, so the server minted a fresh one. The old you is gone.',
    );
  }
  return null;
}

function banner(tone, title, body) {
  return h('div', { class: 'banner banner-' + tone }, h('strong', {}, title), h('span', {}, body));
}

function explainer() {
  return h(
    'section',
    { class: 'explain', id: 'defense' },
    h('h2', {}, 'What just happened'),
    h(
      'ol',
      {},
      h('li', {}, 'On load, the page read your id from every storage vector at once.'),
      h('li', {}, 'It took a consensus of whatever it found (or asked the server for a new id).'),
      h('li', {}, 'It wrote that one id back into every vector — re-seeding any you had cleared.'),
      h('li', {}, 'The server logged the visit, so it can count how often this browser returns.'),
    ),
    h('h2', {}, 'How to actually protect yourself'),
    h(
      'ul',
      {},
      h('li', {}, 'Clear browsing data including ', h('strong', {}, 'cached files'), ' — not just cookies — to evict the ETag / HTTP-cache copies.'),
      h('li', {}, 'Use private / incognito windows, which start with empty storage and discard it on close.'),
      h('li', {}, 'Browsers now ', h('strong', {}, 'partition'), ' storage and caches per top-level site, which blocks the cross-site versions of these tricks.'),
      h('li', {}, 'Extensions like uBlock Origin / Privacy Badger block many third-party trackers before they run.'),
      h('li', {}, 'Hardened browsers and strict privacy modes reduce or partition persistent browser state by design.'),
    ),
  );
}

function footer() {
  return h(
    'footer',
    { class: 'foot' },
    h('span', {}, 'ubercookie · an open educational privacy demonstration'),
  );
}

// --------------------------------------------------------------------------- //

function sectionTitle(title, sub) {
  return h('div', { class: 'section-title' }, h('h2', {}, title), sub ? h('span', {}, sub) : null);
}

function persistNote(persistence) {
  if (!persistence || !persistence.supported) return null;
  const granted = persistence.persisted;
  return h(
    'div',
    { class: 'persist-note ' + (granted ? 'granted' : 'denied') },
    granted
      ? 'The browser granted this site persistent storage — the IndexedDB / Cache / Service Worker / OPFS copies are now exempt from automatic eviction.'
      : 'This site asked for persistent storage (to make its data un-evictable); the browser declined for now.',
  );
}

function countPlanted(result) {
  return result.vectors.filter((v) => v.had || v.respawned).length;
}

function formatDate(iso) {
  if (!iso) return 'recently';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatTime(d) {
  try {
    return d.toLocaleTimeString(undefined, { hour12: false });
  } catch {
    return '';
  }
}
