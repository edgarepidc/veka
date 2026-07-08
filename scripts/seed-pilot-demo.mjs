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
const STAFF_DEMO_EMAIL = 'diazcruzee+jardinero@outlook.com';
const STAFF_DEMO_PASSWORD = 'VekaJardinero1!';
const STAFF_DEMO_NAME = 'Carlos Jardín';
const GUARD_DEMO_EMAIL = 'diazcruzee+guardia@outlook.com';
const GUARD_DEMO_PASSWORD = 'VekaGuardia1!';
const GUARD_DEMO_NAME = 'Roberto Caseta';

const IDS = {
  ticket: '66666666-6666-6666-6666-666666666601',
  schedule: '66666666-6666-6666-6666-666666666602',
  workLog: '66666666-6666-6666-6666-666666666603',
  staffMembership: '77777777-7777-7777-7777-777777777701',
  guardMembership: '77777777-7777-7777-7777-777777777702',
  routinePool: '66666666-6666-6666-6666-666666666610',
  routineGarden: '66666666-6666-6666-6666-666666666611',
  routineTrash: '66666666-6666-6666-6666-666666666612',
  routinePoolDeep: '66666666-6666-6666-6666-666666666613',
  routinePumps: '66666666-6666-6666-6666-666666666614',
  routineElevator: '66666666-6666-6666-6666-666666666615',
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

async function ensureStaffDemoUser(db, env) {
  const projectRef = env.SUPABASE_PROJECT_REF;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn('⚠ Sin SUPABASE_SERVICE_ROLE_KEY: se omite usuario demo de jardinero.');
    return null;
  }

  const supabaseUrl = env.SUPABASE_URL ?? `https://${projectRef}.supabase.co`;

  let staffUserId;
  const [existing] = await db`
    select id from auth.users where email = ${STAFF_DEMO_EMAIL} limit 1
  `;

  if (existing) {
    staffUserId = existing.id;
    console.log(`→ Usuario jardinero ya existe (${STAFF_DEMO_EMAIL})`);
  } else {
    console.log('→ Creando usuario demo de jardinero…');
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: STAFF_DEMO_EMAIL,
        password: STAFF_DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: STAFF_DEMO_NAME },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No se pudo crear el usuario jardinero: ${body}`);
    }

    const created = await res.json();
    staffUserId = created.id;
  }

  await db`
    insert into public.profiles (id, full_name)
    values (${staffUserId}, ${STAFF_DEMO_NAME})
    on conflict (id) do update set full_name = excluded.full_name
  `;

  const [existingMembership] = await db`
    select id from public.memberships
    where user_id = ${staffUserId}
      and condominium_id = ${CONDOMINIUM_ID}
      and unit_id is null
    limit 1
  `;

  if (existingMembership) {
    await db`
      update public.memberships
      set role = 'staff', status = 'active'
      where id = ${existingMembership.id}
    `;
  } else {
    await db`
      insert into public.memberships (id, user_id, condominium_id, unit_id, role, status)
      values (
        ${IDS.staffMembership},
        ${staffUserId},
        ${CONDOMINIUM_ID},
        null,
        'staff',
        'active'
      )
    `;
  }

  return { email: STAFF_DEMO_EMAIL, password: STAFF_DEMO_PASSWORD };
}

async function ensureGuardDemoUser(db, env) {
  const projectRef = env.SUPABASE_PROJECT_REF;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn('⚠ Sin SUPABASE_SERVICE_ROLE_KEY: se omite usuario demo de guardia.');
    return null;
  }

  const supabaseUrl = env.SUPABASE_URL ?? `https://${projectRef}.supabase.co`;

  let guardUserId;
  const [existing] = await db`
    select id from auth.users where email = ${GUARD_DEMO_EMAIL} limit 1
  `;

  if (existing) {
    guardUserId = existing.id;
    console.log(`→ Usuario guardia ya existe (${GUARD_DEMO_EMAIL})`);
  } else {
    console.log('→ Creando usuario demo de guardia…');
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: GUARD_DEMO_EMAIL,
        password: GUARD_DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: GUARD_DEMO_NAME },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No se pudo crear el usuario guardia: ${body}`);
    }

    const created = await res.json();
    guardUserId = created.id;
  }

  await db`
    insert into public.profiles (id, full_name)
    values (${guardUserId}, ${GUARD_DEMO_NAME})
    on conflict (id) do update set full_name = excluded.full_name
  `;

  const [existingMembership] = await db`
    select id from public.memberships
    where user_id = ${guardUserId}
      and condominium_id = ${CONDOMINIUM_ID}
      and unit_id is null
    limit 1
  `;

  if (existingMembership) {
    await db`
      update public.memberships
      set role = 'guard', status = 'active'
      where id = ${existingMembership.id}
    `;
  } else {
    await db`
      insert into public.memberships (id, user_id, condominium_id, unit_id, role, status)
      values (
        ${IDS.guardMembership},
        ${guardUserId},
        ${CONDOMINIUM_ID},
        null,
        'guard',
        'active'
      )
    `;
  }

  return { email: GUARD_DEMO_EMAIL, password: GUARD_DEMO_PASSWORD };
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

  const staffCredentials = await ensureStaffDemoUser(db, env);
  const guardCredentials = await ensureGuardDemoUser(db, env);

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
    insert into public.maintenance_routines (
      id, condominium_id, amenity_id, title, description, day_of_week, recurrence, created_by
    ) values (
      ${IDS.routinePool},
      ${CONDOMINIUM_ID},
      ${poolId},
      'Mantenimiento de alberca',
      'Limpieza de agua, revisión de filtros y cloro.',
      1,
      'weekly',
      ${userId}
    )
    on conflict (id) do nothing
  `;

  await db`
    insert into public.maintenance_routines (
      id, condominium_id, title, description, day_of_week, recurrence, created_by
    ) values
      (${IDS.routineGarden}, ${CONDOMINIUM_ID}, 'Poda de áreas comunes', 'Jardinería en camellones y áreas verdes.', 2, 'weekly', ${userId}),
      (${IDS.routineTrash}, ${CONDOMINIUM_ID}, 'Recolección de basura', 'Ronda en áreas comunes y contenedores.', 3, 'weekly', ${userId})
    on conflict (id) do nothing
  `;

  await db`
    insert into public.maintenance_routines (
      id, condominium_id, amenity_id, title, description, day_of_week, recurrence, anchor_date, created_by
    ) values (
      ${IDS.routinePoolDeep},
      ${CONDOMINIUM_ID},
      ${poolId},
      'Limpieza profunda de alberca',
      'Aspirado y lavado de muros.',
      6,
      'biweekly',
      current_date,
      ${userId}
    )
    on conflict (id) do nothing
  `;

  await db`
    insert into public.maintenance_routines (
      id, condominium_id, title, description, day_of_week, recurrence, monthly_day, created_by
    ) values (
      ${IDS.routinePumps},
      ${CONDOMINIUM_ID},
      'Revisión de bombas de agua',
      'Inspección de cuarto de máquinas.',
      5,
      'monthly',
      15,
      ${userId}
    )
    on conflict (id) do nothing
  `;

  await db`
    insert into public.maintenance_routines (
      id, condominium_id, title, description, recurrence, created_by
    ) values (
      ${IDS.routineElevator},
      ${CONDOMINIUM_ID},
      'Reparación de elevador',
      'Solo cuando falla o hay revisión externa.',
      'on_demand',
      ${userId}
    )
    on conflict (id) do nothing
  `;

  await db`
    insert into public.maintenance_routine_evidence (id, routine_id, evidence_date, image_url, sort_order)
    values
      ('66666666-6666-6666-6666-666666666621', ${IDS.routinePool}, current_date - 3, 'https://picsum.photos/seed/veka-pool-1/800/500', 0),
      ('66666666-6666-6666-6666-666666666622', ${IDS.routinePool}, current_date - 3, 'https://picsum.photos/seed/veka-pool-2/800/500', 1),
      ('66666666-6666-6666-6666-666666666623', ${IDS.routinePool}, current_date - 1, 'https://picsum.photos/seed/veka-pool-3/800/500', 0),
      ('66666666-6666-6666-6666-666666666624', ${IDS.routineGarden}, current_date - 2, 'https://picsum.photos/seed/veka-garden/800/500', 0)
    on conflict (id) do nothing
  `;

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
  if (staffCredentials) {
    console.log('\n👷 Personal de mantenimiento (app mobile):');
    console.log(`   Correo: ${staffCredentials.email}`);
    console.log(`   Contraseña: ${staffCredentials.password}`);
  }
  if (guardCredentials) {
    console.log('\n🛡️ Guardia de seguridad (app mobile):');
    console.log(`   Correo: ${guardCredentials.email}`);
    console.log(`   Contraseña: ${guardCredentials.password}`);
  }
} finally {
  await db.end({ timeout: 5 });
}
