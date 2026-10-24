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
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-include "*.py"
