#!/bin/bash
# Start the AI Genomics Agent in development mode (no Docker)
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== AI Genomics Agent — Dev Start ==="

# Check for .env
if [ ! -f "$ROOT/api/.env" ]; then
  cp "$ROOT/api/.env.example" "$ROOT/api/.env"
  echo "⚠  Created api/.env — add your ANTHROPIC_API_KEY before continuing."
  echo "   Edit: $ROOT/api/.env"
  exit 1
fi

# Start FastAPI
echo "[1/2] Starting FastAPI backend on http://localhost:8000 ..."
cd "$ROOT"
pip install -q -r api/requirements.txt
PYTHONPATH="$ROOT" uvicorn api.main:app --reload --port 8000 &
API_PID=$!

# Start Next.js
echo "[2/2] Starting Next.js frontend on http://localhost:3000 ..."
cd "$ROOT/web"
npm install -q
npm run dev &
WEB_PID=$!

echo ""
echo "✓ Backend:  http://localhost:8000"
echo "✓ Frontend: http://localhost:3000"
echo "✓ API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both services."

trap "kill $API_PID $WEB_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
wait $API_PID $WEB_PID
