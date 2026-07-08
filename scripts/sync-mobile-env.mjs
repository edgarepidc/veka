#!/usr/bin/env node
/**
 * Copia variables EXPO_PUBLIC_* del .env raíz a apps/mobile/.env
 * (Expo solo lee env en apps/mobile).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mobileEnvPath = join(root, 'apps/mobile/.env');

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

const rootEnv = parseEnvFile(join(root, '.env'));
const mobileEnv = parseEnvFile(mobileEnvPath);

const keys = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_ADMIN_URL',
];

const merged = { ...mobileEnv };
let copied = 0;

for (const key of keys) {
  if (rootEnv[key]) {
    merged[key] = rootEnv[key];
    copied += 1;
  }
}

if (!merged.EXPO_PUBLIC_SUPABASE_URL || !merged.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('\n❌ Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('   Agrégalas en .env (raíz) o apps/mobile/.env\n');
  process.exit(1);
}

const lines = [
  '# Generado por scripts/sync-mobile-env.mjs — no edites a mano si usas sync',
  ...keys.filter((key) => merged[key]).map((key) => `${key}=${merged[key]}`),
  '',
];

writeFileSync(mobileEnvPath, lines.join('\n'), 'utf8');
console.log(`✅ apps/mobile/.env actualizado (${copied} variable(s) desde .env raíz).`);
