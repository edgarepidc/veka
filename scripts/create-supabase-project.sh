#!/usr/bin/env bash
# Crea el proyecto Supabase de Veka y configura las variables locales.
# Requiere autenticación en Supabase (una sola vez).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_NAME="${VEKA_SUPABASE_PROJECT_NAME:-veka-prod}"
REGION="${VEKA_SUPABASE_REGION:-us-east-1}"

echo "==> Veka — Crear proyecto Supabase"
echo ""

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  if [ -f "$HOME/.supabase/access-token" ]; then
    export SUPABASE_ACCESS_TOKEN="$(cat "$HOME/.supabase/access-token")"
    echo "✓ Token encontrado en ~/.supabase/access-token"
  else
    echo "Necesitas autenticarte en Supabase primero."
    echo ""
    echo "Opción A — Login en terminal (abre el navegador):"
    echo "  npx supabase login"
    echo ""
    echo "Opción B — Token manual:"
    echo "  1. Ve a https://supabase.com/dashboard/account/tokens"
    echo "  2. Crea un token (scope: todo el proyecto)"
    echo "  3. Ejecuta:"
    echo "     export SUPABASE_ACCESS_TOKEN='tu-token'"
    echo "     npm run create:supabase"
    echo ""
    exit 1
  fi
fi

echo "→ Listando organizaciones..."
ORGS_JSON="$(npx supabase orgs list -o json 2>/dev/null || npx supabase orgs list --output json)"
ORG_ID="$(echo "$ORGS_JSON" | node -e "
  const fs = require('fs');
  const input = fs.readFileSync(0, 'utf8');
  try {
    const data = JSON.parse(input);
    const orgs = Array.isArray(data) ? data : data.organizations ?? [];
    if (!orgs.length) process.exit(2);
    console.log(orgs[0].id);
  } catch { process.exit(2); }
")" || {
  echo "No se encontró organización. Crea una en https://supabase.com/dashboard"
  exit 1
}

echo "✓ Organización: $ORG_ID"

if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  SUPABASE_DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  echo "→ Contraseña de BD generada (guárdala en un lugar seguro)"
fi

echo "→ Creando proyecto '$PROJECT_NAME' en región $REGION..."
CREATE_OUT="$(npx supabase projects create "$PROJECT_NAME" \
  --org-id "$ORG_ID" \
  --db-password "$SUPABASE_DB_PASSWORD" \
  --region "$REGION" \
  -o json 2>&1)" || {
  if echo "$CREATE_OUT" | grep -qi "already exists\|duplicate"; then
    echo "El proyecto ya existe, buscando referencia..."
  else
    echo "$CREATE_OUT"
    exit 1
  fi
}

PROJECT_REF="$(echo "$CREATE_OUT" | node -e "
  const fs = require('fs');
  const input = fs.readFileSync(0, 'utf8');
  try {
    const data = JSON.parse(input);
    console.log(data.id || data.ref || data.project_ref || '');
  } catch {
    const m = input.match(/[a-z]{20}/);
    if (m) console.log(m[0]);
  }
" 2>/dev/null || true)"

if [ -z "$PROJECT_REF" ]; then
  PROJECT_REF="$(npx supabase projects list -o json | node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(0, 'utf8'));
    const projects = Array.isArray(data) ? data : data.projects ?? [];
    const p = projects.find(x => (x.name || '').includes('veka')) || projects[0];
    if (p) console.log(p.id || p.ref);
  ")"
fi

if [ -z "$PROJECT_REF" ]; then
  echo "No se pudo obtener el project ref. Revisa: npx supabase projects list"
  exit 1
fi

echo "✓ Proyecto creado: $PROJECT_REF"
echo "→ Esperando a que el proyecto esté listo (puede tardar 1-2 min)..."
sleep 30

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

write_env() {
  local file="$1"
  cat > "$file" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
SUPABASE_DB_PASSWORD=$SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_REF=$PROJECT_REF
EOF
}

write_env "$ROOT/.env"
cp "$ROOT/.env" "$ROOT/apps/admin/.env.local" 2>/dev/null || true
grep -E '^(EXPO_PUBLIC_|NEXT_PUBLIC_)' "$ROOT/.env" > "$ROOT/apps/mobile/.env" 2>/dev/null || true
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> "$ROOT/apps/admin/.env.local" 2>/dev/null || true
echo "SUPABASE_DB_PASSWORD=$SUPABASE_DB_PASSWORD" >> "$ROOT/apps/admin/.env.local" 2>/dev/null || true

echo "→ Enlazando proyecto local..."
npx supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" --yes

echo "→ Aplicando migraciones..."
npx supabase db push --yes

echo ""
echo "=========================================="
echo "✅ Proyecto Supabase listo"
echo "=========================================="
echo "Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF"
echo "URL:       $SUPABASE_URL"
echo "Ref:       $PROJECT_REF"
echo ""
echo "Variables escritas en:"
echo "  - .env"
echo "  - apps/admin/.env.local"
echo "  - apps/mobile/.env"
echo ""
echo "IMPORTANTE: Guarda SUPABASE_DB_PASSWORD en tu gestor de contraseñas."
echo ""
echo "Siguiente paso en Supabase Dashboard:"
echo "  Authentication → Email → desactiva 'Confirm email' (desarrollo)"
echo "  Authentication → URL Configuration → Site URL: http://localhost:3000"
