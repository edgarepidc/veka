import type { SupabaseClient } from '@supabase/supabase-js';
import {
  allocatePaymentToCharges,
  chargeAmountPaid,
  chargeIdsSettledByPayment,
  roundMoney,
  type ChargeForSettlement,
} from '@veka/shared';

import { reconcileCondominiumFundBalances } from '@/lib/fund-balances';

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

export async function approvePayment(
  supabase: SupabaseClient,
  paymentId: string,
  reviewerId?: string | null,
): Promise<{ ok: true; settledChargeIds: string[] } | { error: string }> {
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('id, charge_id, condominium_id, unit_id, amount, status')
    .eq('id', paymentId)
    .single();

  if (fetchError || !payment) return { error: 'Pago no encontrado.' };
  if (payment.status !== 'pending_review') return { error: 'Este pago ya fue procesado.' };

  const { error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'approved',
      reviewed_by: reviewerId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) return { error: updateError.message };

  try {
    const settledChargeIds = await settleChargesForPayment(
      supabase,
      paymentId,
      payment.charge_id,
      payment.unit_id,
      Number(payment.amount),
    );
    await reconcileCondominiumFundBalances(supabase, payment.condominium_id);
    return { ok: true, settledChargeIds };
  } catch (error) {
    await supabase
      .from('payments')
      .update({ status: 'pending_review', reviewed_by: null, reviewed_at: null })
      .eq('id', paymentId);
    return { error: error instanceof Error ? error.message : 'No se pudieron liquidar los cargos.' };
  }
}
