import os from 'node:os';

function localIpv4() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const port = process.env.EXPO_PORT ?? '8081';
const ip = localIpv4();
const url = `exp://${ip}:${port}`;

console.log('\nAbre esta URL en Expo Go (pestaña Home → Enter URL manually):\n');
console.log(`  ${url}\n`);
console.log('O envíatela por Mensajes/Notas en el iPhone y tócala para abrir Expo Go.\n');
