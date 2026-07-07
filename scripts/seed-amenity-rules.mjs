#!/usr/bin/env node
/**
 * Aplica columnas de reglas por amenidad y valores demo en Las Palmas.
 * Uso: npm run seed:amenity-rules
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const CONDOMINIUM_ID = '22222222-2222-2222-2222-222222222222';

const DEMO_RULES = {
  Alberca: {
    booking_horizon_days: 30,
    min_booking_lead_hours: 2,
    min_cancel_lead_hours: 24,
    max_active_reservations: 1,
    blocked_dates: ['2026-12-25', '2026-01-01'],
  },
  Gimnasio: {
    booking_horizon_days: 14,
    min_booking_lead_hours: 1,
    min_cancel_lead_hours: 12,
    max_active_reservations: 2,
    blocked_dates: [],
  },
  'Salón de eventos': {
    booking_horizon_days: 60,
    min_booking_lead_hours: 48,
    min_cancel_lead_hours: 72,
    max_active_reservations: 1,
    blocked_dates: ['2026-12-24', '2026-12-25', '2026-12-31', '2026-01-01'],
  },
};

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

const migrationSql = readFileSync(
  join(root, 'supabase/migrations/20250621100000_amenity_local_reservation_rules.sql'),
  'utf8',
);

const db = await connectDb(projectRef, dbPassword);

try {
  console.log('→ Aplicando migración de reglas por amenidad…');
  await db.unsafe(migrationSql);

  for (const [name, rules] of Object.entries(DEMO_RULES)) {
    console.log(`  → ${name}`);
    await db`
      update public.amenities
      set
        booking_horizon_days = ${rules.booking_horizon_days},
        min_booking_lead_hours = ${rules.min_booking_lead_hours},
        min_cancel_lead_hours = ${rules.min_cancel_lead_hours},
        max_active_reservations = ${rules.max_active_reservations},
        blocked_dates = ${db.json(rules.blocked_dates)}
      where condominium_id = ${CONDOMINIUM_ID}
        and name = ${name}
    `;
  }

  console.log('\n✅ Reglas demo por amenidad aplicadas en Las Palmas.');
} finally {
  await db.end({ timeout: 5 });
}
