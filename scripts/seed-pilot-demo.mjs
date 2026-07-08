#!/usr/bin/env node
/**
 * Inserta datos narrativos del piloto Las Palmas (comunidad, reservas, seguridad, docs).
 * Resuelve amenidades por nombre para funcionar en prod y local.
 * Uso: npm run seed:pilot-demo
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const CONDOMINIUM_ID = '22222222-2222-2222-2222-222222222222';
const UNIT_ID = '44444444-4444-4444-4444-444444444402';
const DEMO_EMAIL = 'diazcruzee@outlook.com';

const IDS = {
  ticket: '66666666-6666-6666-6666-666666666601',
  schedule: '66666666-6666-6666-6666-666666666602',
  workLog: '66666666-6666-6666-6666-666666666603',
  postAnnouncement: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001',
  postPoll: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002',
  pollOptionYes: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb011',
  pollOptionNo: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb012',
  reservationPool: 'cccccccc-cccc-cccc-cccc-cccccccccc01',
  reservationSalon: 'cccccccc-cccc-cccc-cccc-cccccccccc02',
  visit: 'dddddddd-dddd-dddd-dddd-dddddddddd01',
  package: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
  docRules: '11111111-1111-4111-8111-111111111101',
  docMinutes: '11111111-1111-4111-8111-111111111102',
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

async function rowExists(db, table, id) {
  const [row] = await db`
    select id from ${db(table)} where id = ${id} limit 1
  `;
  return Boolean(row);
}

const db = await connectDb(projectRef, dbPassword);

try {
  console.log('→ Resolviendo usuario y amenidades…');

  const [userRow] = await db`
    select id from auth.users where email = ${DEMO_EMAIL} limit 1
  `;
  if (!userRow) {
    throw new Error(`No existe el usuario demo ${DEMO_EMAIL} en auth.users`);
  }
  const userId = userRow.id;

  const amenityRows = await db`
    select id, name from public.amenities
    where condominium_id = ${CONDOMINIUM_ID}
      and name in ('Alberca', 'Salón de eventos')
  `;
  const amenityByName = Object.fromEntries(amenityRows.map((row) => [row.name, row.id]));
  const poolId = amenityByName['Alberca'];
  const salonId = amenityByName['Salón de eventos'];

  if (!poolId || !salonId) {
    throw new Error('Faltan amenidades Alberca o Salón de eventos en Las Palmas');
  }

  console.log('→ Insertando ticket de mantenimiento…');
  await db`
    insert into public.maintenance_tickets (
      id, condominium_id, unit_id, created_by, title, description, category, status
    ) values (
      ${IDS.ticket},
      ${CONDOMINIUM_ID},
      ${UNIT_ID},
      ${userId},
      'Fuga en lavabo del baño principal',
      'Gotea el lavabo desde ayer por la tarde.',
      'plumbing',
      'open'
    )
    on conflict (id) do nothing
  `;

  console.log('→ Insertando calendario y evidencia de mantenimiento…');
  await db`
    insert into public.maintenance_schedules (
      id, condominium_id, amenity_id, title, description, period_start, period_end, file_url, file_name, created_by
    ) values (
      ${IDS.schedule},
      ${CONDOMINIUM_ID},
      ${poolId},
      'Calendario de mantenimiento — Alberca',
      'Limpieza profunda cada sábado de 8:00 a 11:00. Química y revisión de filtros los miércoles.',
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      'calendario-alberca.pdf',
      ${userId}
    )
    on conflict (id) do nothing
  `;

  await db`
    insert into public.maintenance_work_logs (
      id, condominium_id, amenity_id, ticket_id, title, description, work_date, file_url, file_name, created_by
    ) values (
      ${IDS.workLog},
      ${CONDOMINIUM_ID},
      null,
      ${IDS.ticket},
      'Inspección inicial — fuga lavabo A-102',
      'Se identificó empaque dañado en mezcladora. Se programó cambio de refacción.',
      current_date - 1,
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      'reporte-plomeria.pdf',
      ${userId}
    )
    on conflict (id) do nothing
  `;

  console.log('→ Insertando avisos y encuesta…');
  await db`
    insert into public.posts (
      id, condominium_id, author_id, post_type, title, body, is_pinned, is_formal, is_admin_only
    ) values (
      ${IDS.postAnnouncement},
      ${CONDOMINIUM_ID},
      ${userId},
      'announcement',
      'Mantenimiento de alberca — sábado 8:00',
      'La alberca cerrará el sábado de 8:00 a 11:00 para limpieza profunda. Gracias por su comprensión.',
      true,
      false,
      false
    )
    on conflict (id) do nothing
  `;

  await db`
    insert into public.posts (
      id, condominium_id, author_id, post_type, title, body, is_pinned, is_formal, is_admin_only
    ) values (
      ${IDS.postPoll},
      ${CONDOMINIUM_ID},
      ${userId},
      'poll',
      '¿Apruebas el presupuesto de jardinería Q3?',
      'Votación formal del consejo para el trimestre julio–septiembre.',
      false,
      true,
      false
    )
    on conflict (id) do nothing
  `;

  await db`
    insert into public.poll_options (id, post_id, label)
    values
      (${IDS.pollOptionYes}, ${IDS.postPoll}, 'Sí, aprobar'),
      (${IDS.pollOptionNo}, ${IDS.postPoll}, 'No, requiere ajustes')
    on conflict (id) do nothing
  `;

  console.log('→ Insertando reservas demo…');
  if (!(await rowExists(db, 'public.reservations', IDS.reservationPool))) {
    await db`
      insert into public.reservations (
        id, amenity_id, condominium_id, unit_id, user_id, starts_at, ends_at, status
      ) values (
        ${IDS.reservationPool},
        ${poolId},
        ${CONDOMINIUM_ID},
        ${UNIT_ID},
        ${userId},
        date_trunc('day', now()) + interval '1 day' + interval '18 hours',
        date_trunc('day', now()) + interval '1 day' + interval '19 hours',
        'confirmed'
      )
    `;
  }

  if (!(await rowExists(db, 'public.reservations', IDS.reservationSalon))) {
    await db`
      insert into public.reservations (
        id, amenity_id, condominium_id, unit_id, user_id, starts_at, ends_at, status
      ) values (
        ${IDS.reservationSalon},
        ${salonId},
        ${CONDOMINIUM_ID},
        ${UNIT_ID},
        ${userId},
        date_trunc('day', now()) + interval '10 days' + interval '14 hours',
        date_trunc('day', now()) + interval '10 days' + interval '16 hours',
        'pending'
      )
    `;
  }

  console.log('→ Insertando visita y paquete…');
  await db`
    insert into public.visits (
      id, condominium_id, unit_id, created_by, visitor_name, visitor_phone, visit_type,
      qr_token, valid_from, valid_until
    ) values (
      ${IDS.visit},
      ${CONDOMINIUM_ID},
      ${UNIT_ID},
      ${userId},
      'Carlos Méndez',
      '5512345678',
      'visit',
      'a1b2c3d4e5f6789012345678abcdef01',
      now() - interval '1 hour',
      now() + interval '23 hours'
    )
    on conflict (id) do nothing
  `;

  await db`
    insert into public.packages (
      id, condominium_id, unit_id, carrier, tracking_number, notes, status, received_by
    ) values (
      ${IDS.package},
      ${CONDOMINIUM_ID},
      ${UNIT_ID},
      'Amazon',
      'AMZ-482910',
      'Caja mediana — recepción principal',
      'received',
      ${userId}
    )
    on conflict (id) do nothing
  `;

  console.log('→ Insertando documentos demo…');
  const demoPdf = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

  await db`
    insert into public.documents (id, condominium_id, title, category, file_url, uploaded_by)
    values
      (${IDS.docRules}, ${CONDOMINIUM_ID}, 'Reglamento interno', 'Reglamento', ${demoPdf}, ${userId}),
      (${IDS.docMinutes}, ${CONDOMINIUM_ID}, 'Minuta asamblea marzo 2025', 'Minutas', ${demoPdf}, ${userId})
    on conflict (id) do nothing
  `;

  console.log('\n✅ Datos demo del piloto insertados en Las Palmas (idempotente).');
} finally {
  await db.end({ timeout: 5 });
}
