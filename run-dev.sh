#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PORT="${BACKEND_PORT:-8081}"
FRONTEND_PORT="${FRONTEND_PORT:-5175}"
HOST="${HOST:-127.0.0.1}"
API_BASE_URL="http://${HOST}:${BACKEND_PORT}/api"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

kill_port_processes() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"

  if [[ -z "$pids" ]]; then
    return
  fi

  echo "Stopping existing process(es) on port ${port}: ${pids//$'\n'/ }"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill "$pid" 2>/dev/null || true
  done <<< "$pids"

  sleep 1

  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Force-stopping process(es) still on port ${port}: ${pids//$'\n'/ }"
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      kill -9 "$pid" 2>/dev/null || true
    done <<< "$pids"
  fi
}

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  echo "Backend virtualenv not found. Creating it and installing dependencies..."
  python3 -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_DIR/.venv/bin/python" -m pip install -e "$BACKEND_DIR[test]"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Frontend node_modules not found. Installing dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

kill_port_processes "$BACKEND_PORT"
kill_port_processes "$FRONTEND_PORT"

echo "Starting backend:  http://${HOST}:${BACKEND_PORT}"
(
  cd "$BACKEND_DIR"
  source .venv/bin/activate
  uvicorn app.main:app --host "$HOST" --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "Waiting for backend health check..."
until curl -fsS "http://${HOST}:${BACKEND_PORT}/api/health" >/dev/null; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Backend failed to start."
    exit 1
  fi
  sleep 0.5
done

echo "Starting frontend: http://${HOST}:${FRONTEND_PORT}"
echo "Using backend API: $API_BASE_URL"
cd "$FRONTEND_DIR"
VITE_API_BASE_URL="$API_BASE_URL" npm run dev -- --host "$HOST" --port "$FRONTEND_PORT" --strictPort
