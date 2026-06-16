.PHONY: help install backend frontend dev build test clean

help:
	@echo "ubercookie — make targets:"
	@echo "  make install   install backend (uv) + frontend (npm) deps"
	@echo "  make backend   run FastAPI dev server on :8000"
	@echo "  make frontend  run Vite dev server on :5173 (proxies /api -> :8000)"
	@echo "  make dev       run both backend and frontend together"
	@echo "  make build     build the frontend into frontend/dist"
	@echo "  make test      run backend pytest"
	@echo "  make clean     remove build output and runtime data"

install:
	cd backend && uv sync
	cd frontend && npm install

backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	./scripts/dev.sh

build:
	cd frontend && npm run build

test:
	cd backend && uv run pytest

clean:
	rm -rf frontend/dist backend/data
