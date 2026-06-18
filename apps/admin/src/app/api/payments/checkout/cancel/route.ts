import { NextResponse } from 'next/server';

import { adminBaseUrl } from '@/lib/stripe';

export async function GET() {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Pago cancelado</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Pago cancelado</h1><p>Puedes cerrar esta ventana y volver a la app Veka.</p></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
