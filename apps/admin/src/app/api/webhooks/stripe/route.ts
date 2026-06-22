import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { approvePayment } from '@/lib/payment-approval';
import { syncGatewayPaymentFromSession } from '@/lib/stripe-checkout';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
  if (!session.id) return;

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from('payments')
    .select('id, status')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();

  if (!payment) return;

  const sync = await syncGatewayPaymentFromSession(session);

  await admin
    .from('payments')
    .update({
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      gateway_method: sync.gatewayMethod,
      gateway_reference: sync.gatewayReference,
      gateway_expires_at: sync.gatewayExpiresAt,
      gateway_status: sync.gatewayStatus,
      ...(sync.shouldApprove ? { paid_at: new Date().toISOString() } : {}),
      ...(sync.awaitingPayment ? { status: 'awaiting_payment' } : {}),
    })
    .eq('id', payment.id);

  if (
    sync.shouldApprove &&
    (payment.status === 'pending_review' || payment.status === 'awaiting_payment')
  ) {
    const result = await approvePayment(admin, payment.id, session.metadata?.user_id ?? null, {
      skipDual: true,
    });
    if ('error' in result) {
      console.error('[stripe/webhook] approvePayment failed:', result.error);
    }
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Firma requerida' }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Firma inválida';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    await handleCheckoutSession(event.data.object as Stripe.Checkout.Session);
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = createAdminClient();
    await admin
      .from('payments')
      .update({
        status: 'rejected',
        rejection_reason: 'El pago Oxxo/SPEI no se completó.',
        gateway_status: 'failed',
      })
      .eq('stripe_checkout_session_id', session.id)
      .in('status', ['awaiting_payment', 'pending_review']);
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = createAdminClient();
    await admin
      .from('payments')
      .update({
        status: 'rejected',
        rejection_reason: 'La referencia de pago expiró.',
        gateway_status: 'expired',
      })
      .eq('stripe_checkout_session_id', session.id)
      .in('status', ['awaiting_payment', 'pending_review']);
  }

  return NextResponse.json({ received: true });
}
