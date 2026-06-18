import type { SupabaseClient } from '@supabase/supabase-js';
import { chargeIdsSettledByPayment, type ChargeForSettlement } from '@veka/shared';

import { reconcileCondominiumFundBalances } from '@/lib/fund-balances';

export async function settleChargesForPayment(
  supabase: SupabaseClient,
  paymentId: string,
  primaryChargeId: string,
  unitId: string,
  paymentAmount: number,
): Promise<string[]> {
  const { data: unitCharges, error } = await supabase
    .from('charges')
    .select('id, amount, due_date, status, charge_kind, parent_charge_id')
    .eq('unit_id', unitId);

  if (error) throw new Error(error.message);

  const charges = (unitCharges ?? []) as ChargeForSettlement[];
  const chargeIds = chargeIdsSettledByPayment(primaryChargeId, charges);
  const expectedTotal = charges
    .filter((charge) => chargeIds.includes(charge.id))
    .reduce((sum, charge) => sum + Number(charge.amount), 0);

  if (Math.abs(expectedTotal - paymentAmount) > 0.01) {
    throw new Error(
      `El monto del pago (${paymentAmount}) no coincide con el total a liquidar (${expectedTotal.toFixed(2)}).`,
    );
  }

  const { error: paidError } = await supabase
    .from('charges')
    .update({ status: 'paid' })
    .in('id', chargeIds);

  if (paidError) throw new Error(paidError.message);

  const allocationRows = charges
    .filter((charge) => chargeIds.includes(charge.id))
    .map((charge) => ({
      payment_id: paymentId,
      charge_id: charge.id,
      amount: Number(charge.amount),
    }));

  if (allocationRows.length > 0) {
    const { error: allocError } = await supabase.from('payment_allocations').upsert(allocationRows, {
      onConflict: 'payment_id,charge_id',
    });
    if (allocError) throw new Error(allocError.message);
  }

  return chargeIds;
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
