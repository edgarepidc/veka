#!/usr/bin/env node
/**
 * Precalienta el bundle de Metro para que Expo Go no se quede colgado en la primera carga.
 */
const port = process.env.EXPO_PORT ?? '8081';
const base = `http://127.0.0.1:${port}`;

async function waitForMetro(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${base}/status`);
      if (res.ok) return true;
    } catch {
      // Metro aún no listo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function warmBundle(platform) {
  const url = `${base}/node_modules/expo-router/entry.bundle?platform=${platform}&dev=true&minify=false`;
  const started = Date.now();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Bundle ${platform} falló: HTTP ${res.status}`);
  }
  await res.text();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`   ✓ Bundle ${platform} listo (${seconds}s)`);
}

const ready = await waitForMetro();
if (!ready) {
  console.error('❌ Metro no respondió a tiempo. ¿Está corriendo expo start?');
  process.exit(1);
}

console.log('→ Precalentando bundle para Expo Go…');
await warmBundle('ios');
await warmBundle('android');
console.log('✅ Bundle precalentado. Abre Expo Go ahora.\n');
