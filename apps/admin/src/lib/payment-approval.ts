import type { SupabaseClient } from '@supabase/supabase-js';
import {
  allocatePaymentToCharges,
  chargeAmountPaid,
  chargeIdsSettledByPayment,
  parseApprovalSettings,
  roundMoney,
  shouldRequireDualApproval,
  type ChargeForSettlement,
} from '@veka/shared';

import { parseCondominiumSettings } from '@/lib/condominium-settings';
import { maybeIssueCfdiForPayment } from '@/lib/cfdi';
import { reconcileCondominiumFundBalances } from '@/lib/fund-balances';
import { settleInstallmentPayment } from '@/lib/payment-plan-settlement';

function nextChargeStatus(
  charge: ChargeForSettlement,
  newAmountPaid: number,
): 'paid' | 'pending' | 'overdue' {
  if (newAmountPaid >= Number(charge.amount) - 0.01) return 'paid';
  return charge.status === 'overdue' ? 'overdue' : 'pending';
}

export async function settleChargesForPayment(
  supabase: SupabaseClient,
  paymentId: string,
  primaryChargeId: string,
  unitId: string,
  paymentAmount: number,
): Promise<string[]> {
  const { data: unitCharges, error } = await supabase
    .from('charges')
    .select('id, amount, amount_paid, due_date, status, charge_kind, parent_charge_id')
    .eq('unit_id', unitId);

  if (error) throw new Error(error.message);

  const charges = (unitCharges ?? []) as ChargeForSettlement[];
  const chargeIds = chargeIdsSettledByPayment(primaryChargeId, charges);
  const allocations = allocatePaymentToCharges(paymentAmount, chargeIds, charges);

  for (const allocation of allocations) {
    const charge = charges.find((row) => row.id === allocation.chargeId);
    if (!charge) continue;

    const newAmountPaid = roundMoney(chargeAmountPaid(charge) + allocation.amount);
    const newStatus = nextChargeStatus(charge, newAmountPaid);

    const { error: updateError } = await supabase
      .from('charges')
      .update({ status: newStatus, amount_paid: newAmountPaid })
      .eq('id', allocation.chargeId);

    if (updateError) throw new Error(updateError.message);
  }

  const allocationRows = allocations.map((allocation) => ({
    payment_id: paymentId,
    charge_id: allocation.chargeId,
    amount: allocation.amount,
  }));

  if (allocationRows.length > 0) {
    const { error: allocError } = await supabase.from('payment_allocations').upsert(allocationRows, {
      onConflict: 'payment_id,charge_id',
    });
    if (allocError) throw new Error(allocError.message);
  }

  return allocations.map((allocation) => allocation.chargeId);
}

async function loadApprovalSettings(supabase: SupabaseClient, condominiumId: string) {
  const { data } = await supabase
    .from('condominiums')
    .select('settings')
    .eq('id', condominiumId)
    .maybeSingle();

  const settings = parseCondominiumSettings(data?.settings);
  return parseApprovalSettings(settings.approvals);
}

async function finalizeApprovedPayment(
  supabase: SupabaseClient,
  payment: {
    id: string;
    charge_id: string;
    condominium_id: string;
    unit_id: string;
    amount: number;
    payment_plan_installment_id: string | null;
  },
  reviewerId?: string | null,
): Promise<string[]> {
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'approved',
      reviewed_by: reviewerId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  if (updateError) throw new Error(updateError.message);

  const settledChargeIds = payment.payment_plan_installment_id
    ? await settleInstallmentPayment(
        supabase,
        payment.id,
        payment.payment_plan_installment_id,
        payment.unit_id,
        Number(payment.amount),
      )
    : await settleChargesForPayment(
        supabase,
        payment.id,
        payment.charge_id,
        payment.unit_id,
        Number(payment.amount),
      );

  await reconcileCondominiumFundBalances(supabase, payment.condominium_id);
  await maybeIssueCfdiForPayment(supabase, payment.id, reviewerId ?? null);
  return settledChargeIds;
}

export async function approvePayment(
  supabase: SupabaseClient,
  paymentId: string,
  reviewerId?: string | null,
  options?: { skipDual?: boolean },
): Promise<
  | { ok: true; settledChargeIds: string[]; pendingSecondReview?: boolean }
  | { error: string }
> {
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select(
      'id, charge_id, condominium_id, unit_id, amount, status, payment_method, payment_plan_installment_id, first_reviewed_by',
    )
    .eq('id', paymentId)
    .single();

  if (fetchError || !payment) return { error: 'Pago no encontrado.' };
  if (payment.status === 'approved') return { error: 'Este pago ya fue aprobado.' };
  if (payment.status === 'rejected') return { error: 'Este pago fue rechazado.' };
  if (payment.status === 'awaiting_payment') {
    return { error: 'El residente aún no completa el pago (Oxxo/SPEI).' };
  }

  const approvalSettings = await loadApprovalSettings(supabase, payment.condominium_id);
  const requiresDual =
    !options?.skipDual &&
    shouldRequireDualApproval(approvalSettings, Number(payment.amount), payment.payment_method);

  if (payment.status === 'pending_review' && requiresDual) {
    const { error: firstReviewError } = await supabase
      .from('payments')
      .update({
        status: 'pending_second_review',
        first_reviewed_by: reviewerId ?? null,
        first_reviewed_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (firstReviewError) return { error: firstReviewError.message };
    return { ok: true, settledChargeIds: [], pendingSecondReview: true };
  }

  if (payment.status === 'pending_second_review') {
    if (payment.first_reviewed_by && reviewerId && payment.first_reviewed_by === reviewerId) {
      return { error: 'La segunda aprobación debe hacerla una persona distinta.' };
    }
  } else if (payment.status !== 'pending_review') {
    return { error: 'Este pago ya fue procesado.' };
  }

  try {
    const settledChargeIds = await finalizeApprovedPayment(supabase, payment, reviewerId);
    return { ok: true, settledChargeIds };
  } catch (error) {
    await supabase
      .from('payments')
      .update({
        status: payment.status,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq('id', paymentId);
    return { error: error instanceof Error ? error.message : 'No se pudieron liquidar los cargos.' };
  }
}
