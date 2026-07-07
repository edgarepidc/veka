#!/usr/bin/env node
/**
 * Sube imágenes demo a amenity-images y actualiza public.amenities.image_url.
 * Uso: npm run seed:amenity-images
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const CONDOMINIUM_ID = '22222222-2222-2222-2222-222222222222';

/** Imágenes libres para demo del piloto (Pexels / Unsplash). */
const DEMO_SOURCES = {
  Alberca: 'https://images.pexels.com/photos/261077/pexels-photo-261077.jpeg?auto=compress&cs=tinysrgb&w=900',
  Gimnasio: 'https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Salón de eventos':
    'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=900',
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

async function uploadImage(supabaseUrl, serviceKey, storagePath, buffer, contentType) {
  const encodedPath = storagePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  const res = await fetch(`${supabaseUrl}/storage/v1/object/amenity-images/${encodedPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed for ${storagePath}: ${body}`);
  }
}

const env = loadEnv();
const projectRef = env.SUPABASE_PROJECT_REF;
const dbPassword = env.SUPABASE_DB_PASSWORD;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = `https://${projectRef}.supabase.co`;

if (!projectRef || !dbPassword || !serviceKey) {
  console.error('Faltan SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const db = await connectDb(projectRef, dbPassword);

try {
  const amenities = await db`
    select id, name
    from public.amenities
    where condominium_id = ${CONDOMINIUM_ID}
    order by name
  `;

  if (!amenities.length) {
    console.error('No hay amenidades para el condominio demo. Ejecuta seed.sql primero.');
    process.exit(1);
  }

  console.log(`→ ${amenities.length} amenidad(es) en Las Palmas`);

  for (const amenity of amenities) {
    const sourceUrl = DEMO_SOURCES[amenity.name];
    if (!sourceUrl) {
      console.log(`  · ${amenity.name}: sin imagen demo configurada, se omite`);
      continue;
    }

    const storagePath = `${CONDOMINIUM_ID}/amenities/${amenity.id}.jpg`;
    console.log(`  → ${amenity.name}: descargando…`);

    const imageRes = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'VekaDemoSeed/1.0' },
    });
    if (!imageRes.ok) {
      throw new Error(`No se pudo descargar imagen para ${amenity.name}`);
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg';

    console.log(`  → ${amenity.name}: subiendo a ${storagePath}…`);
    await uploadImage(supabaseUrl, serviceKey, storagePath, buffer, contentType);

    await db`
      update public.amenities
      set image_url = ${storagePath}
      where id = ${amenity.id}
    `;

    console.log(`  ✓ ${amenity.name}`);
  }

  console.log('\n✅ Imágenes demo listas. Recarga la app móvil para verlas.');
} finally {
  await db.end({ timeout: 5 });
}
