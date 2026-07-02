import { NextResponse } from 'next/server';

import { adminBaseUrl } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const miCuentaUrl = new URL('/mi-cuenta', adminBaseUrl()).toString();

  if (sessionId) {
    const admin = createAdminClient();
    await admin
      .from('payments')
      .update({
        status: 'rejected',
        rejection_reason: 'Checkout de pasarela cancelado o no completado.',
        gateway_status: 'cancelled',
      })
      .eq('stripe_checkout_session_id', sessionId)
      .in('status', ['pending_review', 'awaiting_payment']);
  }

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Pago cancelado</title></head><body style="font-family:system-ui;padding:2rem;text-align:center;max-width:28rem;margin:0 auto"><h1>Pago cancelado</h1><p>No se realizó el cobro. Puedes cerrar esta ventana y volver a Mi cuenta para intentar de nuevo.</p><p style="margin-top:2rem"><a href="${miCuentaUrl}" style="display:inline-block;padding:0.75rem 1.25rem;background:#059669;color:#fff;text-decoration:none;border-radius:0.5rem;font-weight:600">Ir a Mi cuenta</a></p></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
