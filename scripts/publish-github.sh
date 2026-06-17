#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="${GITHUB_REPO:-edgarepidc/veka}"
REMOTE="https://github.com/${REPO}.git"

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REMOTE"
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh repo view "$REPO" >/dev/null 2>&1 || \
    gh repo create "$REPO" --public --source=. --remote=origin --description "Plataforma de gestión de condominios"
fi

git push -u origin main
echo "✓ Código en https://github.com/${REPO}"
