#!/bin/bash
# ============================================================
# AI Personal Workspace — Start FastAPI RAG Service
# RUN: ./start-rag.sh  (from AIWorkPlace folder)
# ============================================================

# Anaconda / Conda environment set karo jisme saari libraries installed hain
if [ -d "/opt/homebrew/anaconda3/bin" ]; then
    export PATH="/opt/homebrew/anaconda3/bin:$PATH"
elif [ -d "$HOME/anaconda3/bin" ]; then
    export PATH="$HOME/anaconda3/bin:$PATH"
elif [ -d "$HOME/miniconda3/bin" ]; then
    export PATH="$HOME/miniconda3/bin:$PATH"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load local environment overrides from the repository root (never commit .env).
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$SCRIPT_DIR/.env"
    set +a
fi
cd "$SCRIPT_DIR/rag-service"

# Use or create virtual environment to avoid PEP 668 externally managed environment issues
if [ ! -d "venv" ]; then
    echo "Creating virtual environment for RAG service..."
    if command -v /opt/homebrew/bin/python3.13 &>/dev/null; then
        /opt/homebrew/bin/python3.13 -m venv venv
    else
        python3 -m venv venv
    fi
fi

# Activate virtual environment
source venv/bin/activate

echo ""
echo "======================================"
echo "  🤖 AI Workspace RAG Service"
echo "  Port: 8000"
echo "  Python: $(python3 --version 2>&1) ($(which python3))"
echo "======================================"
echo ""

# Dependencies verify/install
pip install -r requirements.txt -q

# FastAPI server start karo (venv ko reload watching se exclude kiya taaki bar bar restart na ho)
UVICORN_ARGS=()
if [[ "${RAG_ENV:-development}" != "production" && "${RAG_RELOAD:-false}" == "true" ]]; then
    UVICORN_ARGS+=(--reload --reload-include "*.py")
fi

# Free port if already in use by a stale or suspended process
RAG_PORT="${RAG_PORT:-8000}"
EXISTING_PID=$(lsof -ti :"$RAG_PORT" 2>/dev/null)
if [ -n "$EXISTING_PID" ]; then
    echo "⚠️  Port $RAG_PORT is already in use by PID(s): $EXISTING_PID"
    echo "   Cleaning up previous process on port $RAG_PORT..."
    kill -9 $EXISTING_PID 2>/dev/null || true
    sleep 1
fi

exec python3 -m uvicorn main:app --host "${RAG_HOST:-127.0.0.1}" --port "$RAG_PORT" "${UVICORN_ARGS[@]}"
