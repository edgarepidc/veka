#!/usr/bin/env node
/**
 * Ajusta finanzas demo del piloto Las Palmas:
 * - Cuenta CLABE visible en admin y mobile
 * - Fondos positivos (sin saldo negativo en demo)
 * - A-102 con una cuota pendiente y un pago aprobado (sin intentos en revisión)
 * Uso: npm run seed:pilot-finance
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const CONDOMINIUM_ID = '22222222-2222-2222-2222-222222222222';
const UNIT_A102 = '44444444-4444-4444-4444-444444444402';

const IDS = {
  bankAccount: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb201',
  chargeCurrent: '55555555-5555-5555-5555-555555555512',
  chargePrevPaid: '55555555-5555-5555-5555-555555555522',
  paymentApproved: '88888888-8888-8888-8888-888888888803',
  recurringFee: '77777777-7777-7777-7777-777777777701',
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

const db = await connectDb(projectRef, dbPassword);

try {
  console.log('→ Cuenta CLABE demo…');
  await db`
    insert into public.bank_accounts (
      id, condominium_id, name, bank_name, account_last4, clabe, currency, is_active
    ) values (
      ${IDS.bankAccount},
      ${CONDOMINIUM_ID},
      'Cuenta operativa Las Palmas',
      'BBVA México',
      '4821',
      '012180001234567890',
      'MXN',
      true
    )
    on conflict (id) do update set
      name = excluded.name,
      bank_name = excluded.bank_name,
      account_last4 = excluded.account_last4,
      clabe = excluded.clabe,
      is_active = excluded.is_active
  `;

  console.log('→ Fondos positivos (operativo + reserva)…');
  await db`
    insert into public.fund_balances (condominium_id, fund_type, opening_balance, balance, as_of_date)
    values
      (${CONDOMINIUM_ID}, 'operating', 185000.00, 185000.00, current_date),
      (${CONDOMINIUM_ID}, 'reserve', 420000.00, 420000.00, current_date)
    on conflict (condominium_id, fund_type) do update set
      opening_balance = excluded.opening_balance,
      balance = excluded.balance,
      as_of_date = excluded.as_of_date
  `;

  console.log('→ Limpiando pagos y cargos extra de A-102…');
  await db`
    delete from public.payment_allocations pa
    using public.payments p
    where pa.payment_id = p.id
      and p.unit_id = ${UNIT_A102}
  `;
  await db`
    delete from public.payments
    where unit_id = ${UNIT_A102}
  `;

  const removedCharges = await db`
    delete from public.charges
    where unit_id = ${UNIT_A102}
    returning id
  `;
  if (removedCharges.length > 0) {
    console.log(`   Eliminados ${removedCharges.length} cargos extra en A-102`);
  }

  console.log('→ Cuota mes anterior pagada (A-102)…');
  await db`
    insert into public.charges (
      id, condominium_id, unit_id, recurring_fee_id, concept, amount, fund_type, due_date, status, period_month
    ) values (
      ${IDS.chargePrevPaid},
      ${CONDOMINIUM_ID},
      ${UNIT_A102},
      ${IDS.recurringFee},
      'Cuota de mantenimiento — ' || to_char(current_date - interval '1 month', 'TMMonth YYYY'),
      3500.00,
      'operating',
      (date_trunc('month', current_date) - interval '1 month' + interval '4 days')::date,
      'paid',
      (date_trunc('month', current_date) - interval '1 month')::date
    )
    on conflict (id) do update set
      status = 'paid',
      amount = excluded.amount,
      due_date = excluded.due_date,
      period_month = excluded.period_month
  `;

  await db`
    insert into public.payments (
      id, charge_id, condominium_id, unit_id, amount, status, payment_method, paid_at, created_at
    ) values (
      ${IDS.paymentApproved},
      ${IDS.chargePrevPaid},
      ${CONDOMINIUM_ID},
      ${UNIT_A102},
      3500.00,
      'approved',
      'transfer',
      (date_trunc('month', current_date) - interval '1 month' + interval '2 days'),
      (date_trunc('month', current_date) - interval '1 month' + interval '2 days')
    )
    on conflict (id) do update set
      status = 'approved',
      amount = excluded.amount,
      charge_id = excluded.charge_id
  `;

  console.log('→ Cuota del mes actual pendiente (A-102)…');
  await db`
    insert into public.charges (
      id, condominium_id, unit_id, recurring_fee_id, concept, amount, fund_type, due_date, status, period_month
    ) values (
      ${IDS.chargeCurrent},
      ${CONDOMINIUM_ID},
      ${UNIT_A102},
      ${IDS.recurringFee},
      'Cuota de mantenimiento — ' || to_char(current_date, 'TMMonth YYYY'),
      3800.00,
      'operating',
      (current_date + interval '14 days')::date,
      'pending',
      date_trunc('month', current_date)::date
    )
    on conflict (id) do update set
      status = 'pending',
      amount = 3800.00,
      amount_paid = 0,
      due_date = (current_date + interval '14 days')::date,
      period_month = date_trunc('month', current_date)::date
  `;

  const [funds] = await db`
    select coalesce(sum(balance), 0) as total from public.fund_balances
    where condominium_id = ${CONDOMINIUM_ID}
  `;
  const [a102] = await db`
    select
      (select count(*)::int from public.charges where unit_id = ${UNIT_A102}) as charges,
      (select count(*)::int from public.payments where unit_id = ${UNIT_A102}) as payments,
      (select count(*)::int from public.payments where unit_id = ${UNIT_A102} and status != 'approved') as pending_payments
  `;

  console.log('\n✅ Finanzas demo del piloto actualizadas.');
  console.log(`   Fondos consolidados: $${Number(funds.total).toLocaleString('es-MX')}`);
  console.log(`   A-102: ${a102.charges} cargos, ${a102.payments} pagos (${a102.pending_payments} en revisión)`);
} finally {
  await db.end({ timeout: 5 });
}
