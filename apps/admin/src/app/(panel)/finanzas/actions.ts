'use server';

import { revalidatePath } from 'next/cache';
import type { ExpenseKind, ExpenseStatus, FeeScope, FundType } from '@veka/shared';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  EXPENSE_STATUSES,
  FUND_TYPES,
  applyCoefficient,
  currentPeriodMonth,
  nextPeriodMonth,
} from '@veka/shared';

import { DEMO_CONDO_ID } from '@/lib/constants';
import {
  ensureRecurringChargesForCondo,
  recurringFeeHasChargesForPeriod,
} from '@/lib/recurring-fees';
import { createClient } from '@/lib/supabase/server';

export async function ensureMonthlyRecurringCharges() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  try {
    const generated = await ensureRecurringChargesForCondo(supabase, DEMO_CONDO_ID, user.id);
    revalidatePath('/finanzas');
    return { success: true, generated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudieron generar cargos.' };
  }
}

export async function createRecurringFee(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const scope = String(formData.get('scope') ?? '') as 'general' | 'cluster';
  const clusterId = String(formData.get('cluster_id') ?? '').trim();
  const concept = String(formData.get('concept') ?? '').trim();
  const baseAmount = Number(formData.get('base_amount'));
  const dueDay = Number(formData.get('due_day'));
  const fundType = String(formData.get('fund_type') ?? 'operating') as FundType;

  if (scope !== 'general' && scope !== 'cluster') return { error: 'Alcance inválido.' };
  if (!concept) return { error: 'Concepto obligatorio.' };
  if (!baseAmount || baseAmount <= 0) return { error: 'Monto inválido.' };
  if (!dueDay || dueDay < 1 || dueDay > 28) return { error: 'Día de vencimiento inválido (1–28).' };
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };
  if (scope === 'cluster' && !clusterId) return { error: 'Selecciona la torre o cluster.' };

  const { data: fee, error: feeError } = await supabase
    .from('recurring_fees')
    .insert({
      condominium_id: DEMO_CONDO_ID,
      cluster_id: scope === 'cluster' ? clusterId : null,
      scope,
      concept,
      due_day: dueDay,
      fund_type: fundType,
      status: 'active',
      created_by: user.id,
    })
    .select('id, condominium_id, cluster_id, scope, concept, due_day, fund_type, status')
    .single();

  if (feeError || !fee) return { error: feeError?.message ?? 'No se pudo crear la cuota periódica.' };

  const effectiveFrom = currentPeriodMonth();
  const { error: revisionError } = await supabase.from('recurring_fee_revisions').insert({
    recurring_fee_id: fee.id,
    base_amount: baseAmount,
    effective_from: effectiveFrom,
    created_by: user.id,
  });

  if (revisionError) return { error: revisionError.message };

  await ensureRecurringChargesForCondo(supabase, DEMO_CONDO_ID, user.id, effectiveFrom);

  revalidatePath('/finanzas');
  return { success: true };
}

export async function updateRecurringFee(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const feeId = String(formData.get('fee_id') ?? '');
  const concept = String(formData.get('concept') ?? '').trim();
  const baseAmount = Number(formData.get('base_amount'));
  const dueDay = Number(formData.get('due_day'));
  const fundType = String(formData.get('fund_type') ?? 'operating') as FundType;
  let effectiveFrom = String(formData.get('effective_from') ?? '').trim();

  if (!feeId) return { error: 'Cuota inválida.' };
  if (!concept) return { error: 'Concepto obligatorio.' };
  if (!baseAmount || baseAmount <= 0) return { error: 'Monto inválido.' };
  if (!dueDay || dueDay < 1 || dueDay > 28) return { error: 'Día de vencimiento inválido (1–28).' };
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };

  const currentPeriod = currentPeriodMonth();
  if (!effectiveFrom) {
    const hasCurrent = await recurringFeeHasChargesForPeriod(supabase, feeId, currentPeriod);
    effectiveFrom = hasCurrent ? nextPeriodMonth(currentPeriod) : currentPeriod;
  }

  const { error: updateError } = await supabase
    .from('recurring_fees')
    .update({ concept, due_day: dueDay, fund_type: fundType })
    .eq('id', feeId)
    .eq('condominium_id', DEMO_CONDO_ID);

  if (updateError) return { error: updateError.message };

  const { data: latestRevision } = await supabase
    .from('recurring_fee_revisions')
    .select('base_amount, effective_from')
    .eq('recurring_fee_id', feeId)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  const amountChanged =
    !latestRevision ||
    Number(latestRevision.base_amount) !== baseAmount ||
    latestRevision.effective_from !== effectiveFrom;

  if (amountChanged) {
    const { error: revisionError } = await supabase.from('recurring_fee_revisions').insert({
      recurring_fee_id: feeId,
      base_amount: baseAmount,
      effective_from: effectiveFrom,
      created_by: user.id,
    });
    if (revisionError) return { error: revisionError.message };
  }

  if (effectiveFrom <= currentPeriod) {
    await ensureRecurringChargesForCondo(supabase, DEMO_CONDO_ID, user.id, currentPeriod);
  }

  revalidatePath('/finanzas');
  return { success: true, effectiveFrom };
}

export async function setRecurringFeeStatus(feeId: string, status: 'active' | 'paused' | 'cancelled') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };
  if (!feeId) return { error: 'Cuota inválida.' };

  const { error } = await supabase
    .from('recurring_fees')
    .update({ status })
    .eq('id', feeId)
    .eq('condominium_id', DEMO_CONDO_ID);

  if (error) return { error: error.message };

  if (status === 'cancelled') {
    await supabase
      .from('charges')
      .update({ status: 'cancelled' })
      .eq('recurring_fee_id', feeId)
      .in('status', ['pending', 'overdue']);
  }

  revalidatePath('/finanzas');
  return { success: true };
}

export async function createExtraordinaryFee(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const clusterId = String(formData.get('cluster_id') ?? '').trim();
  const concept = String(formData.get('concept') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const dueDate = String(formData.get('due_date') ?? '');
  const fundType = String(formData.get('fund_type') ?? 'operating') as FundType;

  if (!concept) return { error: 'Concepto obligatorio.' };
  if (!amount || amount <= 0) return { error: 'Monto inválido.' };
  if (!dueDate) return { error: 'Fecha de vencimiento obligatoria.' };
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };

  let unitsQuery = supabase
    .from('units')
    .select('id, coefficient')
    .eq('condominium_id', DEMO_CONDO_ID);

  if (clusterId) {
    unitsQuery = unitsQuery.eq('cluster_id', clusterId);
  }

  const { data: units, error: unitsError } = await unitsQuery;
  if (unitsError) return { error: unitsError.message };
  if (!units?.length) return { error: 'No hay unidades en el alcance seleccionado.' };

  const periodMonth = dueDate.slice(0, 8) + '01';

  const { data: campaign, error: campaignError } = await supabase
    .from('fee_campaigns')
    .insert({
      condominium_id: DEMO_CONDO_ID,
      cluster_id: clusterId || null,
      scope: 'extraordinary' satisfies FeeScope,
      concept,
      amount,
      fund_type: fundType,
      due_date: dueDate,
      period_month: periodMonth,
      status: 'active',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (campaignError || !campaign) {
    return { error: campaignError?.message ?? 'No se pudo crear la cuota extraordinaria.' };
  }

  const { error: chargesError } = await supabase.from('charges').insert(
    units.map((unit) => ({
      condominium_id: DEMO_CONDO_ID,
      unit_id: unit.id,
      fee_campaign_id: campaign.id,
      concept,
      amount: applyCoefficient(amount, Number(unit.coefficient ?? 1)),
      fund_type: fundType,
      due_date: dueDate,
      period_month: periodMonth,
      status: 'pending' as const,
      created_by: user.id,
    })),
  );

  if (chargesError) return { error: chargesError.message };

  revalidatePath('/finanzas');
  return { success: true, unitCount: units.length };
}

export async function cancelFeeCampaign(campaignId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };
  if (!campaignId) return { error: 'Cuota inválida.' };

  const { error: campaignError } = await supabase
    .from('fee_campaigns')
    .update({ status: 'cancelled' })
    .eq('id', campaignId)
    .eq('condominium_id', DEMO_CONDO_ID);

  if (campaignError) return { error: campaignError.message };

  const { error: chargesError } = await supabase
    .from('charges')
    .update({ status: 'cancelled' })
    .eq('fee_campaign_id', campaignId)
    .in('status', ['pending', 'overdue']);

  if (chargesError) return { error: chargesError.message };

  revalidatePath('/finanzas');
  return { success: true };
}

export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const concept = String(formData.get('concept') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const category = String(formData.get('category') ?? '');
  const expenseDate = String(formData.get('expense_date') ?? '');
  const fundType = String(formData.get('fund_type') ?? 'operating') as FundType;
  const expenseKind = String(formData.get('expense_kind') ?? 'general') as ExpenseKind;
  const status = String(formData.get('status') ?? 'paid') as ExpenseStatus;
  const vendorName = String(formData.get('vendor_name') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const evidencePath = String(formData.get('evidence_path') ?? '').trim();

  if (!concept) return { error: 'Concepto obligatorio.' };
  if (!amount || amount <= 0) return { error: 'Monto inválido.' };
  if (!EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) {
    return { error: 'Categoría inválida.' };
  }
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };
  if (!EXPENSE_KINDS.includes(expenseKind)) return { error: 'Tipo de egreso inválido.' };
  if (!EXPENSE_STATUSES.includes(status)) return { error: 'Estado inválido.' };
  if (!expenseDate) return { error: 'Fecha obligatoria.' };
  if ((expenseKind === 'supplier' || expenseKind === 'payroll') && !vendorName) {
    return { error: 'Nombre de proveedor o empleado obligatorio.' };
  }

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      condominium_id: DEMO_CONDO_ID,
      concept,
      amount,
      category,
      expense_date: expenseDate,
      fund_type: fundType,
      expense_kind: expenseKind,
      status,
      vendor_name: vendorName || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !expense) return { error: error?.message ?? 'No se pudo registrar el egreso.' };

  if (evidencePath) {
    const fileName = evidencePath.split('/').pop() ?? 'comprobante';
    const { error: attachError } = await supabase.from('expense_attachments').insert({
      expense_id: expense.id,
      file_url: evidencePath,
      file_name: fileName,
    });

    if (attachError) return { error: attachError.message };
  }

  revalidatePath('/finanzas');
  return { success: true };
}