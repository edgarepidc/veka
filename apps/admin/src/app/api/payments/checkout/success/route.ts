import { NextResponse } from 'next/server';

import { approvePayment } from '@/lib/payment-approval';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return htmlResponse('Pago pendiente', 'Tu pago aún se está procesando. Revisa Finanzas en unos minutos.');
    }

    const admin = createAdminClient();
    const { data: payment } = await admin
      .from('payments')
      .select('id, status')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();

    if (payment && payment.status === 'pending_review') {
      await admin
        .from('payments')
        .update({
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
        })
        .eq('id', payment.id);

      await approvePayment(admin, payment.id, session.metadata?.user_id ?? null);
    }

    return htmlResponse('¡Pago recibido!', 'Tu pago fue registrado. Puedes cerrar esta ventana y volver a la app Veka.');
  } catch {
    return htmlResponse('Pago en proceso', 'Si ya pagaste, el estado se actualizará en breve en la app.');
  }
}

function htmlResponse(title: string, message: string) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${title}</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>${title}</h1><p>${message}</p></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
