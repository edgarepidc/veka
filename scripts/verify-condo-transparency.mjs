#!/usr/bin/env node
/**
 * Verifica cifras de transparencia Condominio (vista residente Torre A / A-102).
 * Uso: npm run verify:condo-transparency
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const CONDO_ID = '22222222-2222-2222-2222-222222222222';
const TORRE_A_CLUSTER = '33333333-3333-3333-3333-333333333301';
const DEMO_UNIT = '44444444-4444-4444-4444-444444444402';

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

function periodStart(period) {
  if (period === 'all') return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === '1m') start.setMonth(start.getMonth() - 1);
  else start.setMonth(start.getMonth() - 3);
  return start.toISOString().slice(0, 10);
}

function matchesCluster(clusterId, filter, myClusterId) {
  if (filter === 'all') {
    return clusterId === null || (myClusterId && clusterId === myClusterId);
  }
  if (filter === 'general') return clusterId === null;
  return clusterId === filter;
}

function fmt(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));
}

const env = loadEnv();
const projectRef = env.SUPABASE_PROJECT_REF;
const dbPassword = env.SUPABASE_DB_PASSWORD;

if (!projectRef || !dbPassword) {
  console.error('Faltan SUPABASE_PROJECT_REF o SUPABASE_DB_PASSWORD en .env');
  process.exit(1);
}

const db = await connectDb(projectRef, dbPassword);
const period = process.argv[2] ?? '1m';
const clusterFilter = process.argv[3] ?? 'all';
const since = periodStart(period);

try {
  const [fn] = await db`
    select proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'condo_transparency_payment_income'
  `;
  console.log(`RPC condo_transparency_payment_income: ${fn ? 'OK' : 'FALTA'}`);

  const incomeEntries = await db`
    select category, cluster_id, income_date::text as income_date, amount::float as amount
    from public.income_entries
    where condominium_id = ${CONDO_ID}::uuid
      and (${since}::date is null or income_date >= ${since}::date)
  `;

  const paymentRows = await db`
    select 'cuotas'::text as category, u.cluster_id, coalesce(p.paid_at, p.created_at)::date::text as income_date, p.amount::float as amount
    from public.payments p
    join public.charges c on c.id = p.charge_id
    join public.units u on u.id = p.unit_id
    where c.condominium_id = ${CONDO_ID}::uuid
      and p.status = 'approved'
      and u.cluster_id = ${TORRE_A_CLUSTER}::uuid
      and (${since}::date is null or coalesce(p.paid_at, p.created_at)::date >= ${since}::date)
  `;

  const expenses = await db`
    select category, cluster_id, expense_date::text as expense_date, status, amount::float as amount
    from public.expenses
    where condominium_id = ${CONDO_ID}::uuid
      and (${since}::date is null or expense_date >= ${since}::date)
  `;

  const funds = await db`
    select fund_type, balance::float as balance, as_of_date::text as as_of_date
    from public.fund_balances
    where condominium_id = ${CONDO_ID}::uuid
  `;

  const scopedIncome = [...incomeEntries, ...paymentRows.map((r) => ({ ...r, source: 'payment' }))].filter(
    (row) => matchesCluster(row.cluster_id, clusterFilter, TORRE_A_CLUSTER),
  );

  const scopedExpenses = expenses.filter((row) =>
    matchesCluster(row.cluster_id, clusterFilter, TORRE_A_CLUSTER),
  );

  const cuotas = scopedIncome
    .filter((row) => row.category === 'cuotas' || row.source === 'payment')
    .reduce((s, r) => s + r.amount, 0);
  const otros = scopedIncome
    .filter((row) => row.category !== 'cuotas' && row.source !== 'payment')
    .reduce((s, r) => s + r.amount, 0);

  const expPaid = scopedExpenses
    .filter((e) => e.status === 'paid')
    .reduce((s, e) => s + e.amount, 0);
  const expPending = scopedExpenses
    .filter((e) => e.status === 'pending')
    .reduce((s, e) => s + e.amount, 0);

  const byCategory = new Map();
  for (const e of scopedExpenses.filter((row) => row.status === 'paid')) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  const totalFunds = funds.reduce((s, f) => s + f.balance, 0);

  console.log(`\nVista simulada: unidad A-102 · período ${period} · filtro ${clusterFilter}`);
  console.log('─'.repeat(52));
  console.log(`INGRESOS total:     ${fmt(cuotas + otros)}`);
  console.log(`  Cuotas cobradas:  ${fmt(cuotas)} (${paymentRows.length} pago(s) Torre A)`);
  console.log(`  Otros ingresos:   ${fmt(otros)}`);
  console.log(`EGRESOS total:      ${fmt(expPaid + expPending)}`);
  console.log(`  Pagado:           ${fmt(expPaid)}`);
  console.log(`  Pendiente:        ${fmt(expPending)}`);
  console.log(`FONDOS:             ${fmt(totalFunds)}`);
  console.log('\nEgresos pagados por categoría:');
  for (const [cat, amt] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = expPaid > 0 ? ((amt / expPaid) * 100).toFixed(0) : '0';
    console.log(`  ${cat.padEnd(16)} ${fmt(amt).padStart(12)}  (${pct}%)`);
  }

  const [demoUser] = await db`
    select u.id
    from auth.users u
    join public.memberships m on m.user_id = u.id
    where u.email = 'diazcruzee@outlook.com'
      and m.unit_id = ${DEMO_UNIT}::uuid
      and m.status = 'active'
    limit 1
  `;
  if (demoUser?.id) {
    const rpcRows = await db`
      select category, cluster_id, income_date::text as income_date, amount::float as amount
      from public.condo_transparency_payment_income(${CONDO_ID}::uuid, ${since}::date)
    `;
    console.log(`\nRPC bajo sesión service (sin auth.uid): ${rpcRows.length} filas`);
    console.log('(En app, el RPC filtra por auth.uid() del residente autenticado.)');
  }
} finally {
  await db.end({ timeout: 5 });
}
