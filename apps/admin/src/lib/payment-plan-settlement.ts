import type { SupabaseClient } from '@supabase/supabase-js';
import {
  allocatePaymentToCharges,
  chargeAmountPaid,
  orderChargeIdsForPlan,
  installmentBalanceDue,
  type ChargeForSettlement,
} from '@veka/shared';
import { roundMoney } from '@veka/shared';

function nextChargeStatus(
  charge: ChargeForSettlement,
  newAmountPaid: number,
): 'paid' | 'pending' | 'overdue' {
  if (newAmountPaid >= Number(charge.amount) - 0.01) return 'paid';
  return charge.status === 'overdue' ? 'overdue' : 'pending';
}

function nextInstallmentStatus(
  installment: { amount: number; due_date: string },
  newAmountPaid: number,
): 'paid' | 'pending' | 'overdue' {
  if (newAmountPaid >= Number(installment.amount) - 0.01) return 'paid';
  const due = new Date(`${installment.due_date}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return due < today ? 'overdue' : 'pending';
}

async function maybeCompletePlan(supabase: SupabaseClient, planId: string): Promise<void> {
  const { data: installments } = await supabase
    .from('payment_plan_installments')
    .select('status')
    .eq('plan_id', planId);

  const allInstallmentsPaid = (installments ?? []).every((row) => row.status === 'paid');
  if (!allInstallmentsPaid) return;

  const { data: links } = await supabase
    .from('payment_plan_charges')
    .select('charge_id')
    .eq('plan_id', planId);

  const chargeIds = (links ?? []).map((row) => row.charge_id as string);
  if (chargeIds.length === 0) {
    await supabase
      .from('payment_plans')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', planId);
    return;
  }

  const { data: charges } = await supabase
    .from('charges')
    .select('id, status')
    .in('id', chargeIds);

  const chargesSettled = (charges ?? []).every((row) => row.status === 'paid');
  if (!chargesSettled) return;

  await supabase
    .from('payment_plans')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', planId);
}

export async function settleInstallmentPayment(
  supabase: SupabaseClient,
  paymentId: string,
  installmentId: string,
  unitId: string,
  paymentAmount: number,
): Promise<string[]> {
  const { data: installment, error: installmentError } = await supabase
    .from('payment_plan_installments')
    .select('id, plan_id, installment_number, due_date, amount, amount_paid, status')
    .eq('id', installmentId)
    .single();

  if (installmentError || !installment) {
    throw new Error('Parcialidad del plan no encontrada.');
  }

  const maxInstallment = installmentBalanceDue(installment);
  if (paymentAmount > maxInstallment + 0.01) {
    throw new Error(
      `El monto excede la parcialidad ${installment.installment_number} (${maxInstallment.toFixed(2)}).`,
    );
  }

  const { data: plan } = await supabase
    .from('payment_plans')
    .select('id, status, unit_id')
    .eq('id', installment.plan_id)
    .single();

  if (!plan || plan.status !== 'active') {
    throw new Error('El plan de pago no está activo.');
  }
  if (plan.unit_id !== unitId) {
    throw new Error('La parcialidad no corresponde a esta unidad.');
  }

  const { data: links } = await supabase
    .from('payment_plan_charges')
    .select('charge_id')
    .eq('plan_id', plan.id);

  const linkedChargeIds = (links ?? []).map((row) => row.charge_id as string);
  if (linkedChargeIds.length === 0) {
    throw new Error('El plan no tiene cargos vinculados.');
  }

  const { data: unitCharges, error: chargesError } = await supabase
    .from('charges')
    .select('id, amount, amount_paid, due_date, status, charge_kind, parent_charge_id')
    .eq('unit_id', unitId);

  if (chargesError) throw new Error(chargesError.message);

  const charges = (unitCharges ?? []) as ChargeForSettlement[];
  const orderedChargeIds = orderChargeIdsForPlan(linkedChargeIds, charges);
  const allocations = allocatePaymentToCharges(paymentAmount, orderedChargeIds, charges);

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

  const newInstallmentPaid = roundMoney(
    installmentAmountPaid(installment) + paymentAmount,
  );
  const installmentStatus = nextInstallmentStatus(installment, newInstallmentPaid);

  const { error: installmentUpdateError } = await supabase
    .from('payment_plan_installments')
    .update({ amount_paid: newInstallmentPaid, status: installmentStatus })
    .eq('id', installmentId);

  if (installmentUpdateError) throw new Error(installmentUpdateError.message);

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

  await maybeCompletePlan(supabase, plan.id);

  return allocations.map((allocation) => allocation.chargeId);
}

function installmentAmountPaid(installment: { amount_paid?: number }): number {
  return roundMoney(Number(installment.amount_paid ?? 0));
}
