import { NextResponse } from 'next/server';

import { approvePayment } from '@/lib/payment-approval';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/mi-cuenta', request.url));
  }

  const miCuentaUrl = new URL('/mi-cuenta', request.url).toString();

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return htmlResponse(
        'Pago pendiente',
        'Tu pago aún se está procesando. Revisa Mi cuenta en unos minutos.',
        miCuentaUrl,
      );
    }

    const admin = createAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('id, status')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    if (!payment) {
      return htmlResponse(
        'Pago recibido',
        'Stripe confirmó el pago. Si no ves el cargo actualizado, contacta a administración.',
        miCuentaUrl,
      );
    }

    if (payment.status === 'approved') {
      return htmlResponse(
        '¡Pago recibido!',
        'Tu pago ya estaba registrado. Puedes cerrar esta ventana.',
        miCuentaUrl,
      );
    }

    if (payment.status === 'pending_review' || payment.status === 'awaiting_payment') {
      await admin
        .from('payments')
        .update({
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        })
        .eq('id', payment.id);

      if (session.payment_status === 'paid') {
        const result = await approvePayment(admin, payment.id, session.metadata?.user_id ?? null, {
          skipDual: true,
        });
        if ('error' in result) {
          console.error('[checkout/success] approvePayment failed:', result.error);
          return htmlResponse(
            'Pago recibido en Stripe',
            'El cobro se procesó, pero la confirmación en Veka tardará unos minutos. Revisa Mi cuenta o espera la notificación del webhook.',
            miCuentaUrl,
          );
        }
      }
    }

    return htmlResponse(
      '¡Pago recibido!',
      'Tu pago fue registrado. Puedes cerrar esta ventana y volver a Mi cuenta.',
      miCuentaUrl,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[checkout/success]', message);
    return htmlResponse(
      'Pago en proceso',
      'Stripe recibió tu pago. Si Mi cuenta no se actualiza en 5 minutos, avisa a administración.',
      miCuentaUrl,
    );
  }
}

function htmlResponse(title: string, message: string, linkHref: string) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head><body style="font-family:system-ui;padding:2rem;text-align:center;max-width:28rem;margin:0 auto"><h1>${title}</h1><p style="line-height:1.5;color:#444">${message}</p><p style="margin-top:2rem"><a href="${linkHref}" style="display:inline-block;padding:0.75rem 1.25rem;background:#059669;color:#fff;text-decoration:none;border-radius:0.5rem;font-weight:600">Ir a Mi cuenta</a></p></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
