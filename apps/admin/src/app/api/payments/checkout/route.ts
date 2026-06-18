import { NextResponse } from 'next/server';
import {
  buildNextPaymentGroup,
  chargeIdsSettledByPayment,
  type ChargeForSettlement,
} from '@veka/shared';

import { adminBaseUrl, getStripe, isStripeConfigured } from '@/lib/stripe';
import { createClientFromRequest } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Pasarela de pagos no configurada' }, { status: 503 });
  }

  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = (await request.json()) as { chargeId?: string };
  const chargeId = body.chargeId?.trim();
  if (!chargeId) {
    return NextResponse.json({ error: 'chargeId requerido' }, { status: 400 });
  }

  const { data: charge, error: chargeError } = await supabase
    .from('charges')
    .select('id, unit_id, condominium_id, concept, amount, due_date, status, charge_kind, parent_charge_id')
    .eq('id', chargeId)
    .single();

  if (chargeError || !charge) {
    return NextResponse.json({ error: 'Cargo no encontrado' }, { status: 404 });
  }

  if (charge.status === 'paid' || charge.status === 'cancelled') {
    return NextResponse.json({ error: 'Este cargo ya no está pendiente.' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('unit_id', charge.unit_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'No tienes acceso a esta unidad.' }, { status: 403 });
  }

  const { data: unitCharges } = await supabase
    .from('charges')
    .select('id, amount, due_date, status, charge_kind, parent_charge_id')
    .eq('unit_id', charge.unit_id);

  const charges = (unitCharges ?? []) as ChargeForSettlement[];
  const group = buildNextPaymentGroup(charges);
  if (!group || !group.chargeIds.includes(chargeId)) {
    return NextResponse.json({ error: 'No se pudo calcular el monto a pagar.' }, { status: 400 });
  }

  const chargeIds = chargeIdsSettledByPayment(chargeId, charges);
  const totalAmount = charges
    .filter((row) => chargeIds.includes(row.id))
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const baseUrl = adminBaseUrl();
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: group.primaryCharge.charge_kind === 'late_fee' ? charge.concept : `Cuota — ${charge.concept}`,
            description:
              group.relatedCharges.length > 0
                ? `Incluye ${group.relatedCharges.length} recargo(s) por mora`
                : `Vence ${charge.due_date}`,
          },
          unit_amount: Math.round(totalAmount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      charge_id: chargeId,
      charge_ids: chargeIds.join(','),
      condominium_id: charge.condominium_id,
      unit_id: charge.unit_id,
      user_id: user.id,
    },
    success_url: `${baseUrl}/api/payments/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/api/payments/checkout/cancel`,
  });

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      charge_id: chargeId,
      condominium_id: charge.condominium_id,
      unit_id: charge.unit_id,
      amount: totalAmount,
      status: 'pending_review',
      payment_method: 'gateway',
      stripe_checkout_session_id: session.id,
      paid_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single();

  if (paymentError || !payment) {
    return NextResponse.json({ error: paymentError?.message ?? 'No se pudo registrar el pago' }, { status: 400 });
  }

  return NextResponse.json({ url: session.url, paymentId: payment.id });
}
