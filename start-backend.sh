#!/bin/bash
# ============================================================
# AI Personal Workspace — Spring Boot Backend Starter
# RUN: ./start-backend.sh  (from AIWorkPlace folder)
# ============================================================
set -e

# Java 21 set karo (Lombok ke liye zaroor)
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH

# backend/ folder mein jao
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

echo ""
echo "======================================"
echo "  🚀 AI Workspace Backend"
echo "  Port: 8080"
echo "  Java: $(java -version 2>&1 | head -1)"
echo "======================================"
echo ""

mvn spring-boot:run
