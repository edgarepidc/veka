#!/usr/bin/env bash
# Enlaza un proyecto Supabase YA CREADO en el dashboard y aplica migraciones.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f "$HOME/.supabase/access-token" ]; then
  export SUPABASE_ACCESS_TOKEN="$(cat "$HOME/.supabase/access-token")"
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Primero autoriza la CLI en tu terminal:"
  echo "  npx supabase login"
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

if [ -z "$PROJECT_REF" ] || [ -z "$DB_PASSWORD" ]; then
  echo "Crea el proyecto en https://supabase.com/dashboard/new/new-project"
  echo "Luego agrega a .env:"
  echo "  SUPABASE_PROJECT_REF=tu-project-ref"
  echo "  SUPABASE_DB_PASSWORD=tu-contraseña-de-bd"
  echo ""
  echo "El project-ref está en Settings → General (ej: abcdefghijklmnop)"
  exit 1
fi

echo "→ Enlazando proyecto $PROJECT_REF..."
npx supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD" --yes

echo "→ Obteniendo API keys..."
KEYS_JSON="$(npx supabase projects api-keys --project-ref "$PROJECT_REF" -o json)"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
ANON_KEY="$(echo "$KEYS_JSON" | node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const keys = Array.isArray(data) ? data : data.api_keys ?? [];
  const anon = keys.find(k => k.name === 'anon' || k.type === 'anon');
  console.log(anon?.api_key || anon?.key || '');
")"
SERVICE_KEY="$(echo "$KEYS_JSON" | node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const keys = Array.isArray(data) ? data : data.api_keys ?? [];
  const svc = keys.find(k => k.name === 'service_role' || k.type === 'service_role');
  console.log(svc?.api_key || svc?.key || '');
")"

cat > "$ROOT/.env" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
SUPABASE_DB_PASSWORD=$DB_PASSWORD
SUPABASE_PROJECT_REF=$PROJECT_REF
EOF

cp "$ROOT/.env" "$ROOT/apps/admin/.env.local"
grep -E '^(EXPO_PUBLIC_)' "$ROOT/.env" > "$ROOT/apps/mobile/.env"

echo "→ Aplicando migraciones..."
npx supabase db push --yes

echo ""
echo "✅ Proyecto enlazado y migraciones aplicadas"
echo "Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF"
echo "URL: $SUPABASE_URL"
