#!/usr/bin/env node
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

async function connectDb(projectRef, dbPassword) {
  const poolerHosts = [
    `db.${projectRef}.supabase.co`,
    'aws-1-us-east-1.pooler.supabase.com',
    'aws-0-us-east-1.pooler.supabase.com',
    'aws-0-sa-east-1.pooler.supabase.com',
  ];

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
      connect_timeout: 20,
    });

    try {
      await db`select 1`;
      return db;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await db.end({ timeout: 1 }).catch(() => undefined);
    }
  }

  throw new Error(lastError || 'No se pudo conectar a la base de datos');
}

const env = loadEnv();
const projectRef = env.SUPABASE_PROJECT_REF;
const dbPassword = env.SUPABASE_DB_PASSWORD;

if (!projectRef || !dbPassword) {
  console.error('Faltan SUPABASE_PROJECT_REF o SUPABASE_DB_PASSWORD en .env');
  process.exit(1);
}

const sql = readFileSync(
  join(root, 'supabase/migrations/20250623150000_profiles_condo_members_select.sql'),
  'utf8',
);

const db = await connectDb(projectRef, dbPassword);

try {
  console.log('→ Aplicando política de perfiles entre vecinos…');
  await db.unsafe(sql);
  console.log('\n✅ Migración aplicada.');
} finally {
  await db.end({ timeout: 5 });
}
