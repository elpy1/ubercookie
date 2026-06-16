#!/usr/bin/env bash
# Run the FastAPI backend (:8000) and the Vite dev server (:5173) together.
# Stop either one with Ctrl-C and both are torn down.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

( cd "$ROOT/backend" && exec uv run uvicorn app.main:app --reload --port 8000 ) &
BACKEND_PID=$!

cleanup() { kill "$BACKEND_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "backend  → http://localhost:8000  (pid $BACKEND_PID)"
echo "frontend → http://localhost:5173"
echo

cd "$ROOT/frontend" && npm run dev
