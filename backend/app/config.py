"""Runtime configuration, all overridable via environment variables."""

import os
from pathlib import Path

# …/backend
BASE_DIR = Path(__file__).resolve().parent.parent

# Where the SQLite observation log lives.
DATA_DIR = Path(os.environ.get("GIGACOOKIE_DATA_DIR", BASE_DIR / "data"))
DB_PATH = DATA_DIR / "ubercookie.sqlite3"

# Name of the server-set (HttpOnly) cookie vector.
COOKIE_NAME = os.environ.get("GIGACOOKIE_COOKIE", "gid")

# Add the Secure flag to cookies — turn this on ("1") when served over HTTPS.
COOKIE_SECURE = os.environ.get("GIGACOOKIE_SECURE", "0") == "1"

# Cookie lifetime in seconds (default ~1 year).
COOKIE_MAX_AGE = int(os.environ.get("GIGACOOKIE_COOKIE_MAX_AGE", str(60 * 60 * 24 * 365)))

# Optional cross-origin dev origins (comma separated). The recommended dev setup
# uses the Vite proxy so the whole app stays same-origin and no CORS is needed.
CORS_ORIGINS = [o.strip() for o in os.environ.get("GIGACOOKIE_CORS_ORIGINS", "").split(",") if o.strip()]

# Built frontend (frontend/dist). When present, FastAPI serves it at "/".
FRONTEND_DIST = Path(
    os.environ.get("GIGACOOKIE_FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist")
)

# Request header the client uses to push a chosen id into the server-cache
# vectors (ETag + embedded-id script).
SET_HEADER = "x-ubercookie-set"
