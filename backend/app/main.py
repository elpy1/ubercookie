"""ubercookie FastAPI application.

Exposes the *server-side* tracking vectors and the observation-log API that the
frontend orchestrates:

  POST   /api/visit          mint/record an id, set the HttpOnly cookie, return stats
  GET    /api/whoami         report the HttpOnly cookie the server sees (+ record)
  GET    /api/etag-id        the ETag supercookie (read via If-None-Match, write via header)
  GET    /api/lastmod-id     the Last-Modified supercookie
  GET    /api/cache-id.js    a script with the id baked in, cached "immutable" for a year
  POST   /api/clear-cookie   expire just the HttpOnly cookie (per-vector clear)
  DELETE /api/forget         wipe the server record and cookie for this browser
  GET    /api/health         liveness probe

Everything here is intentionally observable from the UI. Nothing is hidden from
the user — that's the whole point.
"""

from contextlib import asynccontextmanager
from email.utils import formatdate, parsedate_to_datetime

from fastapi import Body, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import config, ids, store


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.init()
    yield


# Also initialise eagerly so the schema exists even when the app is driven
# without its lifespan running (e.g. a bare TestClient).
store.init()

app = FastAPI(
    title="ubercookie",
    description="An educational demonstration of persistent web tracking.",
    version="0.1.0",
    lifespan=lifespan,
)

if config.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["ETag"],
    )


def _set_tracking_cookie(resp: Response, value: str) -> None:
    resp.set_cookie(
        key=config.COOKIE_NAME,
        value=value,
        max_age=config.COOKIE_MAX_AGE,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def _etag_from_header(raw: str | None) -> str | None:
    """Extract a valid id from an If-None-Match (or ETag) header value."""
    if not raw:
        return None
    value = raw.strip()
    if value.startswith("W/"):  # weak validator prefix
        value = value[2:].strip()
    value = value.strip('"')
    return ids.coerce(value)


# --------------------------------------------------------------------------- #
# Server-side vectors                                                         #
# --------------------------------------------------------------------------- #

@app.get("/api/etag-id")
def etag_id(request: Request) -> Response:
    """ETag supercookie.

    The browser caches this response and revalidates it on every revisit,
    echoing the stored id back to us in the ``If-None-Match`` header — no cookie
    and no JavaScript required. We report what we recovered, and (re)stamp the
    ETag so it survives into the next visit.
    """
    recovered = _etag_from_header(request.headers.get("if-none-match"))
    requested = ids.coerce(request.headers.get(config.SET_HEADER))
    stamped = requested or recovered

    headers = {
        # "no-cache" = the browser MAY store this but must revalidate before
        # reuse, which is exactly what makes it send If-None-Match every time.
        "Cache-Control": "no-cache",
    }
    if stamped:
        headers["ETag"] = f'"{stamped}"'
    return JSONResponse({"recovered": recovered, "stamped": stamped}, headers=headers)


@app.get("/api/lastmod-id")
def lastmod_id(request: Request) -> Response:
    """Last-Modified supercookie — the coarser cousin of the ETag trick.

    The server encodes the id into the ``Last-Modified`` date of a cached
    resource; the browser echoes it back via ``If-Modified-Since`` on every
    revisit. A date carries only ~32 bits, so we map the id to a 32-bit token and
    recover the full id through the observation log.
    """
    recovered = None
    ims = request.headers.get("if-modified-since")
    if ims:
        try:
            dt = parsedate_to_datetime(ims)
            if dt is not None:
                recovered = store.find_by_lastmod_token(int(dt.timestamp()) & 0xFFFFFFFF)
        except (TypeError, ValueError, OverflowError):
            recovered = None

    requested = ids.coerce(request.headers.get(config.SET_HEADER))
    stamped = requested or recovered

    headers = {"Cache-Control": "no-cache"}
    if stamped:
        headers["Last-Modified"] = formatdate(store.lastmod_token(stamped), usegmt=True)
    return JSONResponse({"recovered": recovered, "stamped": stamped}, headers=headers)


@app.get("/api/cache-id.js")
def cache_id_js(request: Request) -> Response:
    """HTTP-cache supercookie: a script with the id baked into its body.

    On the *write* path (the client sends the set-header) we return the id inside
    an ``immutable``, year-long cached script. The browser then serves that exact
    file — old id and all — on every later visit until the cache is cleared.
    """
    requested = ids.coerce(request.headers.get(config.SET_HEADER))
    if requested:
        body = f'globalThis.__GIGACOOKIE_CACHE_ID = "{requested}";\n'
        return Response(
            content=body,
            media_type="application/javascript",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    # Cold/read path with no id supplied: hand back an uncacheable stub so we
    # never poison the cache with a value the client did not choose.
    return Response(
        content="globalThis.__GIGACOOKIE_CACHE_ID = null;\n",
        media_type="application/javascript",
        headers={"Cache-Control": "no-store"},
    )


# --------------------------------------------------------------------------- #
# Observation log + cookie vector                                             #
# --------------------------------------------------------------------------- #

@app.post("/api/visit")
def visit(request: Request, payload: dict | None = Body(default=None)) -> Response:
    """Record a visit. Mints a new id when the client has none, sets the cookie."""
    payload = payload or {}
    proposed = ids.coerce(payload.get("id"))

    recovered_from = payload.get("recovered_from")
    if not isinstance(recovered_from, list):
        recovered_from = []
    recovered_from = [str(s)[:40] for s in recovered_from][:32]

    # The server's own HttpOnly cookie is itself a recovery source.
    cookie_id = ids.coerce(request.cookies.get(config.COOKIE_NAME))
    if cookie_id and "serverCookie" not in recovered_from:
        recovered_from.append("serverCookie")

    chosen = proposed or cookie_id
    minted_now = chosen is None
    if chosen is None:
        chosen = ids.mint()

    record = store.record_visit(chosen, recovered_from)
    record["minted_now"] = minted_now
    record["total_browsers"] = store.total_browsers()

    resp = JSONResponse(record)
    _set_tracking_cookie(resp, chosen)
    return resp


@app.get("/api/whoami")
def whoami(request: Request) -> dict:
    """Report the HttpOnly cookie the server can see (JS cannot read it directly)."""
    cookie_id = ids.coerce(request.cookies.get(config.COOKIE_NAME))
    record = store.get(cookie_id) if cookie_id else None
    return {"cookie": cookie_id, "record": record, "total_browsers": store.total_browsers()}


@app.post("/api/clear-cookie")
def clear_cookie() -> Response:
    """Expire only the HttpOnly cookie — keeps the record (per-vector clear demo)."""
    resp = JSONResponse({"cleared": True})
    resp.delete_cookie(config.COOKIE_NAME, path="/")
    return resp


@app.delete("/api/forget")
def forget(request: Request, payload: dict | None = Body(default=None)) -> Response:
    """Wipe the server record and cookie for this browser."""
    payload = payload or {}
    targets = set()
    cookie_id = ids.coerce(request.cookies.get(config.COOKIE_NAME))
    if cookie_id:
        targets.add(cookie_id)
    body_id = ids.coerce(payload.get("id"))
    if body_id:
        targets.add(body_id)

    forgotten = [i for i in targets if store.forget(i)]
    resp = JSONResponse({"forgotten": forgotten})
    resp.delete_cookie(config.COOKIE_NAME, path="/")
    return resp


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Frontend serving (production). In dev, use the Vite dev server + /api proxy. #
# --------------------------------------------------------------------------- #

if config.FRONTEND_DIST.is_dir():
    # Mounted last so the /api routes above always take precedence.
    app.mount("/", StaticFiles(directory=str(config.FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    def dev_root() -> PlainTextResponse:
        return PlainTextResponse(
            "ubercookie backend is running.\n\n"
            "No frontend build found. Either:\n"
            "  • run the Vite dev server:  cd frontend && npm run dev   (recommended)\n"
            "  • or build it:              cd frontend && npm run build (FastAPI then serves it)\n"
        )
