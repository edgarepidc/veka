#!/usr/bin/env bash
set -euo pipefail

echo "==> Veka — Supabase Cloud setup"
echo ""
echo "Este script verifica prerequisitos. Para enlazar tu proyecto cloud:"
echo ""
echo "  npx supabase login"
echo "  npx supabase link --project-ref TU_PROJECT_REF"
echo "  npx supabase db push"
echo ""
echo "Ver docs/SUPABASE_SETUP.md para el flujo completo."
echo ""

if ! command -v docker &>/dev/null; then
  echo "⚠️  Docker no encontrado. Necesario solo para Supabase local."
else
  echo "✓ Docker disponible"
fi

if [ ! -f ".env" ]; then
  echo "→ Copiando .env.example → .env"
  cp .env.example .env
  echo "  Edita .env con tus credenciales de Supabase Cloud"
else
  echo "✓ .env existe"
fi

for f in apps/mobile/.env apps/admin/.env.local; do
  if [ ! -f "$f" ]; then
    example="${f%.local}.example"
    [ -f "$example" ] || example="${f}.example"
    if [ -f "$example" ]; then
      cp "$example" "$f"
      echo "→ Copiado $example → $f"
    fi
  fi
done

echo ""
echo "Listo. Siguiente paso: configurar credenciales y ejecutar 'npx supabase db push'"
