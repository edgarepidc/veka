import { NextResponse } from 'next/server';
import {
  buildNextPaymentGroup,
  chargeIdsSettledByPayment,
  groupBalanceDue,
  installmentBalanceDue,
  orderChargeIdsForPlan,
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

  const body = (await request.json()) as {
    chargeId?: string;
    installmentId?: string;
    amount?: number;
  };
  const installmentId = body.installmentId?.trim();
  const chargeIdInput = body.chargeId?.trim();

  if (!installmentId && !chargeIdInput) {
    return NextResponse.json({ error: 'chargeId o installmentId requerido' }, { status: 400 });
  }

  let chargeId = chargeIdInput ?? '';
  let installmentLabel = '';
  let maxOwed = 0;
  let paymentAmount = body.amount != null && Number.isFinite(Number(body.amount)) ? Number(body.amount) : 0;
  let groupDescription = '';
  let isPartial = false;

  if (installmentId) {
    const { data: installment, error: installmentError } = await supabase
      .from('payment_plan_installments')
      .select(
        'id, installment_number, due_date, amount, amount_paid, status, plan:payment_plans(id, title, status, unit_id, condominium_id)',
      )
      .eq('id', installmentId)
      .single();

    if (installmentError || !installment) {
      return NextResponse.json({ error: 'Parcialidad no encontrada' }, { status: 404 });
    }

    const planRaw = installment.plan as
      | {
          id: string;
          title: string;
          status: string;
          unit_id: string;
          condominium_id: string;
        }
      | {
          id: string;
          title: string;
          status: string;
          unit_id: string;
          condominium_id: string;
        }[]
      | null;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;

    if (!plan) {
      return NextResponse.json({ error: 'Plan de pago no encontrado.' }, { status: 404 });
    }

    if (plan.status !== 'active') {
      return NextResponse.json({ error: 'El plan de pago no está activo.' }, { status: 400 });
    }

    maxOwed = installmentBalanceDue(installment);
    if (maxOwed <= 0) {
      return NextResponse.json({ error: 'Esta parcialidad ya está pagada.' }, { status: 400 });
    }

    if (!paymentAmount) paymentAmount = maxOwed;
    if (paymentAmount > maxOwed + 0.01) {
      return NextResponse.json(
        { error: `El monto no puede exceder la parcialidad (${maxOwed.toFixed(2)}).` },
        { status: 400 },
      );
    }

    const { data: links } = await supabase
      .from('payment_plan_charges')
      .select('charge_id')
      .eq('plan_id', plan.id);

    const linkedIds = (links ?? []).map((row) => row.charge_id as string);
    if (!linkedIds.length) {
      return NextResponse.json({ error: 'El plan no tiene cargos vinculados.' }, { status: 400 });
    }

    const { data: unitCharges } = await supabase
      .from('charges')
      .select('id, amount, amount_paid, due_date, status, charge_kind, parent_charge_id')
      .eq('unit_id', plan.unit_id);

    const charges = (unitCharges ?? []) as ChargeForSettlement[];
    chargeId = orderChargeIdsForPlan(linkedIds, charges)[0] ?? linkedIds[0]!;
    installmentLabel = `${plan.title} · Parcialidad ${installment.installment_number}`;
    groupDescription = `Vence ${installment.due_date}`;
    isPartial = paymentAmount < maxOwed - 0.01;

    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('unit_id', plan.unit_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'No tienes acceso a esta unidad.' }, { status: 403 });
    }

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
              name: installmentLabel,
              description: isPartial
                ? `Abono parcial · saldo de parcialidad ${maxOwed.toFixed(2)} MXN`
                : groupDescription,
            },
            unit_amount: Math.round(paymentAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        charge_id: chargeId,
        installment_id: installmentId,
        condominium_id: plan.condominium_id,
        unit_id: plan.unit_id,
        user_id: user.id,
        partial: isPartial ? 'true' : 'false',
      },
      success_url: `${baseUrl}/api/payments/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/api/payments/checkout/cancel`,
    });

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        charge_id: chargeId,
        condominium_id: plan.condominium_id,
        unit_id: plan.unit_id,
        amount: paymentAmount,
        status: 'pending_review',
        payment_method: 'gateway',
        stripe_checkout_session_id: session.id,
        payment_plan_installment_id: installmentId,
        paid_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select('id')
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: paymentError?.message ?? 'No se pudo registrar el pago' }, { status: 400 });
    }

    return NextResponse.json({
      url: session.url,
      paymentId: payment.id,
      amount: paymentAmount,
      partial: isPartial,
    });
  }

  const { data: charge, error: chargeError } = await supabase
    .from('charges')
    .select('id, unit_id, condominium_id, concept, amount, amount_paid, due_date, status, charge_kind, parent_charge_id')
    .eq('id', chargeId)
    .single();

  if (chargeError || !charge) {
    return NextResponse.json({ error: 'Cargo no encontrado' }, { status: 404 });
  }

  if (charge.status === 'paid' || charge.status === 'cancelled' || charge.status === 'forgiven') {
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
    .select('id, amount, amount_paid, due_date, status, charge_kind, parent_charge_id')
    .eq('unit_id', charge.unit_id);

  const charges = (unitCharges ?? []) as ChargeForSettlement[];
  const group = buildNextPaymentGroup(charges);
  if (!group || !group.chargeIds.includes(chargeId)) {
    return NextResponse.json({ error: 'No se pudo calcular el monto a pagar.' }, { status: 400 });
  }

  const chargeIds = chargeIdsSettledByPayment(chargeId, charges);
  maxOwed = groupBalanceDue(chargeIds, charges);
  if (!paymentAmount) paymentAmount = maxOwed;

  if (paymentAmount <= 0) {
    return NextResponse.json({ error: 'El monto debe ser mayor a cero.' }, { status: 400 });
  }
  if (paymentAmount > maxOwed + 0.01) {
    return NextResponse.json(
      { error: `El monto no puede exceder el saldo pendiente (${maxOwed.toFixed(2)}).` },
      { status: 400 },
    );
  }

  isPartial = paymentAmount < maxOwed - 0.01;
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
            description: isPartial
              ? `Abono parcial · saldo del grupo ${maxOwed.toFixed(2)} MXN`
              : group.relatedCharges.length > 0
                ? `Incluye ${group.relatedCharges.length} recargo(s) por mora`
                : `Vence ${charge.due_date}`,
          },
          unit_amount: Math.round(paymentAmount * 100),
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
      partial: isPartial ? 'true' : 'false',
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
      amount: paymentAmount,
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

  return NextResponse.json({ url: session.url, paymentId: payment.id, amount: paymentAmount, partial: isPartial });
}
