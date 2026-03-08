#!/usr/bin/env bash
set -euo pipefail

# Disable Compose bake integration — buildx bake hangs on metadata-file write
# on Docker Desktop (macOS). The legacy compose builder works reliably.
export COMPOSE_BAKE=false

REGISTRY="ghcr.io"
IMAGE="ghcr.io/fysoul17/pyx-memory"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"

echo "=== Agent Forge Setup ==="
echo ""

# ── Upstream protection ─────────────────────────────────────────────────────
# If this repo is a downstream fork (not the template itself), ensure the
# upstream remote is read-only to prevent accidental pushes back to template.
TEMPLATE_URL="https://github.com/fysoul17/agent-forge.git"
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -n "$ORIGIN_URL" ] && [ "$ORIGIN_URL" != "$TEMPLATE_URL" ]; then
  # This is a downstream fork — set up read-only upstream
  if ! git remote | grep -q '^upstream$'; then
    echo "Adding read-only upstream remote (template)..."
    git remote add upstream "$TEMPLATE_URL"
    git remote set-url --push upstream DISABLE
    echo "  upstream (fetch): $TEMPLATE_URL"
    echo "  upstream (push):  DISABLED"
  elif [ "$(git remote get-url --push upstream 2>/dev/null)" != "DISABLE" ]; then
    echo "Locking upstream remote to read-only..."
    git remote set-url --push upstream DISABLE
    echo "  upstream push: DISABLED"
  else
    echo "Upstream remote: OK (read-only)"
  fi
  echo ""
fi

# Check Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

# Check if already authenticated
if docker pull "$IMAGE:0.1.1-beta" --quiet >/dev/null 2>&1; then
  echo "GHCR authentication: OK"
  echo "Setup complete! Run:"
  echo "  docker compose -f docker/docker-compose.yaml --profile full up --build"
  exit 0
fi

# Read token from .env
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found."
  echo "Copy .env.example to .env and set GHCR_TOKEN:"
  echo "  cp .env.example .env"
  exit 1
fi

GHCR_TOKEN=$(grep -E '^GHCR_TOKEN=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '[:space:]')

if [ -z "$GHCR_TOKEN" ] || [ "$GHCR_TOKEN" = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" ]; then
  echo "Error: GHCR_TOKEN is not set in .env"
  echo "Add your token to .env:"
  echo "  GHCR_TOKEN=ghp_your_token_here"
  exit 1
fi

echo "Logging into GHCR..."
echo "$GHCR_TOKEN" | docker login "$REGISTRY" --username "agent-forge" --password-stdin

echo ""
echo "Setup complete! Run:"
echo "  docker compose -f docker/docker-compose.yaml --profile full up --build"
