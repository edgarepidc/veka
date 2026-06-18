import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { approvePayment } from '@/lib/payment-approval';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === 'paid' && session.id) {
      const admin = createAdminClient();
      const { data: payment } = await admin
        .from('payments')
        .select('id, status')
        .eq('stripe_checkout_session_id', session.id)
        .maybeSingle();

      if (payment && payment.status === 'pending_review') {
        await admin
          .from('payments')
          .update({
            stripe_payment_intent_id:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id ?? null,
          })
          .eq('id', payment.id);

        const reviewerId = session.metadata?.user_id;
        if (reviewerId) {
          await approvePayment(admin, payment.id, reviewerId);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
