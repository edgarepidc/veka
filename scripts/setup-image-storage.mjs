#!/usr/bin/env node
/**
 * Crea buckets avatars + branding y aplica políticas RLS en Supabase Cloud.
 * Uso: npm run setup:image-storage
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const envPath = join(root, '.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

async function createBucket(url, serviceKey, id) {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, name: id, public: true }),
  });

  if (res.ok) return { ok: true };
  const body = await res.text();
  if (/already exists|duplicate/i.test(body)) {
    return { ok: true, existed: true };
  }
  return { ok: false, error: body };
}

const env = loadEnv();
const projectRef = env.SUPABASE_PROJECT_REF;
const dbPassword = env.SUPABASE_DB_PASSWORD;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const url = `https://${projectRef}.supabase.co`;

if (!projectRef || !dbPassword || !serviceKey) {
  console.error('Faltan SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

console.log('→ Creando buckets de storage…');
for (const id of ['avatars', 'branding']) {
  const result = await createBucket(url, serviceKey, id);
  if (result.ok) {
    console.log(`  ✓ ${id}${result.existed ? ' (ya existía)' : ''}`);
  } else {
    console.error(`  ✗ ${id}:`, result.error);
    process.exit(1);
  }
}

const migrationPath = join(
  root,
  'supabase/migrations/20250617200000_avatars_and_branding_storage.sql',
);
let sql = readFileSync(migrationPath, 'utf8');
sql = sql.replace(/insert into storage\.buckets[\s\S]*?on conflict \(id\) do nothing;\s*/i, '');

console.log('→ Aplicando políticas RLS…');

const poolerHosts = [
  `db.${projectRef}.supabase.co`,
  'aws-1-us-east-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-sa-east-1.pooler.supabase.com',
];

let applied = false;
let lastError = '';

for (const host of poolerHosts) {
  const isPooler = host.includes('pooler');
  const db = postgres({
    host,
    port: 5432,
    database: 'postgres',
    username: isPooler ? `postgres.${projectRef}` : 'postgres',
    password: dbPassword,
    ssl: 'require',
    max: 1,
    connect_timeout: 15,
  });

  try {
    await db.unsafe(sql);
    console.log(`  ✓ Políticas aplicadas (${host})`);
    applied = true;
    await db.end();
    break;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    if (/already exists/i.test(lastError)) {
      console.log('  ✓ Políticas (ya existían)');
      applied = true;
      await db.end();
      break;
    }
    await db.end({ timeout: 1 }).catch(() => undefined);
  }
}

if (!applied) {
  console.error('  ✗ No se pudo conectar a la base de datos:', lastError);
  console.error('    Los buckets ya existen. Pega el SQL de la migración en el SQL Editor de Supabase.');
  process.exit(1);
}

console.log('\n✅ Storage listo. Prueba subir logo o avatar en producción.');
