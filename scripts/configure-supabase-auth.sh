#!/usr/bin/env bash
set -euo pipefail

# Configura URLs de Auth en Supabase Cloud (Management API).
# Requiere: SUPABASE_ACCESS_TOKEN desde https://supabase.com/dashboard/account/tokens

PROJECT_REF="${SUPABASE_PROJECT_REF:-ubmtcwdgryfwldjfqwim}"
SITE_URL="${1:-https://veka-admin.vercel.app}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Exporta SUPABASE_ACCESS_TOKEN (dashboard → Account → Access Tokens)"
  exit 1
fi

ALLOW_LIST=$(cat <<EOF
${SITE_URL}/**
https://*.vercel.app/**
http://localhost:3000/**
http://localhost:8081/**
veka://**
exp://**
EOF
)

curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg site "$SITE_URL" \
    --arg allow "$ALLOW_LIST" \
    '{site_url: $site, uri_allow_list: $allow, mailer_autoconfirm: true}')" | jq .

echo "✓ Auth URLs actualizadas (site_url=${SITE_URL})"
