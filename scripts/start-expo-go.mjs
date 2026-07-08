#!/usr/bin/env node
/**
 * Arranca Expo Go con env sincronizado, caché limpia y bundle precalentado.
 * Uso: npm run dev:mobile
 *      npm run dev:mobile -- --tunnel
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mobileDir = join(root, 'apps/mobile');
const useTunnel = process.argv.includes('--tunnel');

function localIpv4() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function runNodeScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [join(root, 'scripts', scriptName)], {
      cwd: root,
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${scriptName} exit ${code}`))));
  });
}

// Sincronizar env
await runNodeScript('sync-mobile-env.mjs');

const mobileEnv = join(mobileDir, '.env');
if (!existsSync(mobileEnv)) {
  console.error('\n❌ Falta apps/mobile/.env — corre: node scripts/sync-mobile-env.mjs\n');
  process.exit(1);
}

const envLines = readFileSync(mobileEnv, 'utf8');
if (!envLines.includes('EXPO_PUBLIC_SUPABASE_URL=') || envLines.includes('your-cloud-anon-key')) {
  console.error('\n❌ Revisa EXPO_PUBLIC_* en .env (raíz) y vuelve a sincronizar.\n');
  process.exit(1);
}

// Liberar puerto
spawn('sh', ['-c', 'lsof -ti:8081 | xargs kill -9 2>/dev/null || true'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const args = ['start', '--go', '--clear'];
if (useTunnel) args.push('--tunnel');
else args.push('--lan');

console.log(`\n→ Iniciando Expo (${useTunnel ? 'tunnel' : 'LAN'})…\n`);

const expo = spawn('npx', ['expo', ...args], {
  cwd: mobileDir,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, EXPO_NO_DOTENV: '0' },
});

let warmed = false;
let tunnelReady = false;

function maybeWarm() {
  if (warmed) return;
  warmed = true;
  setTimeout(() => {
    void runNodeScript('warm-expo-bundle.mjs').catch((err) => {
      console.error('⚠️  No se pudo precalentar bundle:', err.message);
    });
  }, 1500);
}

expo.stdout?.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (text.includes('Tunnel ready') || text.includes('Metro waiting') || text.includes('Waiting on http://')) {
    tunnelReady = true;
    maybeWarm();
  }
});

expo.stderr?.on('data', (chunk) => {
  process.stderr.write(chunk);
});

expo.on('exit', (code) => process.exit(code ?? 0));

setTimeout(() => {
  if (!tunnelReady) maybeWarm();
}, 12000);

if (!useTunnel) {
  const ip = localIpv4();
  const url = `exp://${ip}:8081`;
  setTimeout(() => {
    console.log('\n────────────────────────────────────────');
    console.log('  Expo Go → Home → Enter URL manually:');
    console.log(`  ${url}`);
    console.log('  (iPhone y Mac en la misma Wi‑Fi)');
    console.log('────────────────────────────────────────\n');
  }, 8000);
}
