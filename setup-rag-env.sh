#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
TEMPLATE="$ROOT_DIR/.env.example"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing .env.example; refusing to create an environment file." >&2
  exit 2
fi

if [[ -e "$ENV_FILE" ]]; then
  echo "Existing .env preserved: $ENV_FILE"
else
  umask 077
  cp "$TEMPLATE" "$ENV_FILE"
  chmod 600 "$ENV_FILE" 2>/dev/null || true
  echo "Created ignored local .env from .env.example"
fi

if ! grep -q '^RAG_VECTOR_BACKEND=qdrant$' "$ENV_FILE"; then
  echo "Warning: RAG_VECTOR_BACKEND is not qdrant in your .env; inspect it before starting the service."
fi

echo
echo "Next steps:"
echo "  1. Edit .env locally; set GEMINI_API_KEY and verify DB_USER / DB_PASSWORD / JWT_SECRET / RAG_API_KEY."
echo "  2. Keep .env private. It is covered by .gitignore; commit .env.example, never .env."
echo "  3. Start Docker, then run: docker compose -f docker-compose.rag.yml up -d"
echo "  4. Install Python packages: python3 -m venv rag-service/venv && source rag-service/venv/bin/activate && pip install -r rag-service/requirements.txt"
echo "  5. Re-index after checking source files: python rag-service/reindex_documents.py --dry-run"
echo
