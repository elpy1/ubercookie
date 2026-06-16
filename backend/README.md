# ubercookie — backend

FastAPI service providing the **server-side** tracking vectors and the
observation log. See the [root README](../README.md) for the full picture.

## Run (dev)

```bash
uv sync                                            # create venv + install deps
uv run uvicorn app.main:app --reload --port 8000
```

The API is then at `http://localhost:8000/api/...`. In development the frontend
runs separately under Vite and proxies `/api` here (see `../frontend`).

## Test

```bash
uv run pytest
```

## Endpoints

| Method | Path                 | Vector / purpose                                  |
|--------|----------------------|---------------------------------------------------|
| POST   | `/api/visit`         | Mint/record id, set HttpOnly cookie, return stats |
| GET    | `/api/whoami`        | Report the HttpOnly cookie the server sees        |
| GET    | `/api/etag-id`       | ETag supercookie (read via `If-None-Match`)       |
| GET    | `/api/lastmod-id`    | Last-Modified supercookie                         |
| GET    | `/api/cache-id.js`   | Script with the id baked in, cached "immutable"   |
| POST   | `/api/clear-cookie`  | Expire just the HttpOnly cookie                   |
| DELETE | `/api/forget`        | Wipe the server record + cookie                    |
| GET    | `/api/health`        | Liveness                                          |

## Config (env vars)

| Variable                  | Default               | Meaning                                   |
|---------------------------|-----------------------|-------------------------------------------|
| `GIGACOOKIE_DATA_DIR`     | `backend/data`        | SQLite location                           |
| `GIGACOOKIE_COOKIE`       | `gid`                 | HttpOnly cookie name                      |
| `GIGACOOKIE_SECURE`       | `0`                   | Set `1` over HTTPS to add the Secure flag |
| `GIGACOOKIE_COOKIE_MAX_AGE` | `31536000`          | Cookie lifetime (seconds)                 |
| `GIGACOOKIE_CORS_ORIGINS` | _(empty)_             | Comma-separated origins for cross-origin dev |
| `GIGACOOKIE_FRONTEND_DIST`| `frontend/dist`       | Built frontend to serve at `/`            |
