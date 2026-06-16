# 🍪 ubercookie

**An educational demonstration of how websites persistently identify you — and
why "clear your cookies" is no longer enough.**

ubercookie plants a single random id into 12 different browser storage vectors at
once. Every time you visit, it reads them all, takes a consensus, and re-writes
the id back everywhere. Clear any one store — or even all your cookies — and the
survivors silently *respawn* it. The site shows you, in plain language, exactly
where your id is hiding and how often it has recognised your browser.

It is the same idea behind Samy Kamkar's classic **evercookie** — built here as
an open, transparent teaching aid focused on storage respawn and supercookie
persistence.

> [!IMPORTANT]
> This project tracks the visitor **on purpose**, for awareness. It is
> first-party only, stores only a random id, visit counts, first/last-seen
> timestamps, and recovery-source labels, shares nothing with third parties, and
> ships a real **"Forget me"** button. Don't repurpose it to track people
> without their knowledge or consent — that's the opposite of the point. See
> [Ethics](#ethics).

---

## What it demonstrates

| Vector | Kind | Needs JS? | Clearable from JS? | What it teaches |
|---|---|---|---|---|
| `document.cookie` | client | yes | yes | The baseline tracker |
| `localStorage` | client | yes | yes | Survives cookie clears |
| `sessionStorage` | client | yes | yes | Per-tab redundancy |
| `IndexedDB` | client | yes | yes | A whole DB people forget to clear |
| Cache API (`caches`) | client | yes | yes | Programmable store, separate from the above |
| `window.name` | client | yes | yes | Persists across navigations |
| **OPFS** (Origin Private File System) | client | yes | yes | A sandboxed filesystem manual clean-ups miss |
| **Service Worker + Cache** | client | yes | yes | Background script re-serves the id, even offline |
| Server cookie (`HttpOnly`) | server | no | via server | Invisible to JS, still sent every request |
| **ETag supercookie** | server | no | **cache wipe only** | Id echoed back in `If-None-Match` |
| **Last-Modified supercookie** | server | no | **cache wipe only** | Id encoded in the cached resource's date |
| **HTTP cache** (embedded-id script) | server | no | **cache wipe only** | Id baked into an `immutable` cached file |

On top of these, the page asks the browser for **persistent storage**
(`navigator.storage.persist()`), which exempts the IndexedDB / Cache / Service
Worker / OPFS copies from automatic eviction — making them even harder to shed.

The three **cache-based** vectors are the persistence punchline: they live in the
browser's HTTP cache, so JavaScript (including our own "Forget me") *cannot*
delete them — only clearing your browser cache does. That's how the id comes
back from the dead.

A full write-up of the implemented storage vectors, plus the HSTS supercookie
idea that still fits this project, is in **[`docs/techniques.md`](docs/techniques.md)**.

---

## Architecture

```
ubercookie/
├── backend/            FastAPI — server-side vectors + the observation log (SQLite)
│   └── app/
│       ├── main.py     endpoints: /api/visit, /api/whoami, /api/etag-id,
│       │               /api/lastmod-id, /api/cache-id.js, /api/clear-cookie,
│       │               /api/forget
│       ├── store.py    "we've seen this browser N times" memory
│       └── ids.py      mint/validate the 32-hex tracking id
└── frontend/           Vanilla JS + Vite — the dashboard and the client vectors
    └── src/ubercookie/
        ├── index.js    orchestrator: read-all → consensus → respawn → report
        └── vectors/    one self-contained module per storage vector
```

**How a visit works** (`frontend/src/ubercookie/index.js`):

1. **Read** every vector in parallel.
2. **Consensus** — pick the id most vectors agree on (or none, if you're new).
3. **Report** to the server, which mints a fresh id if you had none, records the
   visit, and sets the `HttpOnly` cookie.
4. **Respawn** — write that one id back into every vector that was missing it.

---

## Quick start

Requires **Python ≥ 3.11** (with [`uv`](https://docs.astral.sh/uv/)) and
**Node ≥ 18**.

```bash
make install        # backend deps (uv) + frontend deps (npm)

# then, in two terminals:
make backend        # FastAPI on http://localhost:8000
make frontend       # Vite on  http://localhost:5173  (proxies /api → :8000)
```

Open **http://localhost:5173** and watch yourself get tracked. Open DevTools,
delete some stores, hit **Re-scan**, and watch them respawn.

> One-liner for both servers at once: `./scripts/dev.sh`

### Production-style (FastAPI serves the built frontend, single origin)

```bash
make build                                   # → frontend/dist
cd backend && uv run uvicorn app.main:app --port 8000
# open http://localhost:8000
```

Serving both from one origin is the most faithful setup, because the cache/ETag
vectors depend on real same-origin HTTP caching.

---

## Testing

```bash
make test           # backend pytest (server-side vector logic + observation log)
make build          # frontend production build
```

The backend tests exercise the server-side vectors and observation log. Browser
behaviour still needs a real browser to verify because several vectors depend on
origin storage, Service Workers, and HTTP caching.

---

## Ethics

This is a **defensive / awareness** tool. Guidelines baked into the design:

- **Transparency** — every stored value is shown to the user on the page.
- **First-party only** — no third-party requests, no cross-site tracking.
- **Minimal data** — a random id, first/last-seen timestamps, a visit counter,
  and labels for the vectors that recovered the id. No PII and nothing leaves
  the server.
- **Real opt-out** — the *Forget me* button clears everything reachable and
  deletes the server record; the page is honest about what only a cache wipe can
  remove.

Please keep any fork in the same spirit: use it to *teach people how tracking
works so they can defend themselves*, not to track them covertly.

## License

MIT — see [`LICENSE`](LICENSE).
