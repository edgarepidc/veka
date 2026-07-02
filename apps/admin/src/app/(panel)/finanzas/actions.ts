'use server';

import { revalidatePath } from 'next/cache';
import type { ExpenseKind, ExpenseStatus, FeeScope, FundType, IncomeCategory } from '@veka/shared';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  EXPENSE_STATUSES,
  FUND_TYPES,
  INCOME_CATEGORIES,
  LATE_FEE_APPLY_MODES,
  LATE_FEE_TYPES,
  applyCoefficient,
  buildInstallmentSchedule,
  chargeBalanceDue,
  currentPeriodMonth,
  nextPeriodMonth,
  parseBudgetAmount,
} from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { runDailyFinanceMaintenance } from '@/lib/finance-cron';
import { reconcileCondominiumFundBalances } from '@/lib/fund-balances';
import { ensureLateFeesForCondo } from '@/lib/late-fees';
import { deliverChargeReminder } from '@/lib/notifications';
import {
  ensureRecurringChargesForCondo,
  recurringFeeHasChargesForPeriod,
} from '@/lib/recurring-fees';
import { createClient } from '@/lib/supabase/server';
import { assertAdminAction } from '@/lib/require-admin';

async function resolveCondoId(value?: string | null): Promise<string | { error: string }> {
  return requireActiveCondominiumId(value);
}

export async function ensureMonthlyRecurringCharges(condominiumId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const condoResult = await resolveCondoId(condominiumId);
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  try {
    await supabase.rpc('refresh_charge_statuses');
    const generated = await ensureRecurringChargesForCondo(supabase, condoId, user.id);
    const lateFees = await ensureLateFeesForCondo(supabase, condoId, user.id);
    await reconcileCondominiumFundBalances(supabase, condoId);
    revalidatePath('/finanzas');
    return { success: true, generated, lateFees };
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

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { data: fee, error: feeError } = await supabase
    .from('recurring_fees')
    .insert({
      condominium_id: condoId,
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

  await ensureRecurringChargesForCondo(supabase, condoId, user.id, effectiveFrom);

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

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { error: updateError } = await supabase
    .from('recurring_fees')
    .update({ concept, due_day: dueDay, fund_type: fundType })
    .eq('id', feeId)
    .eq('condominium_id', condoId);

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
    await ensureRecurringChargesForCondo(supabase, condoId, user.id, currentPeriod);
  }

  revalidatePath('/finanzas');
  return { success: true, effectiveFrom };
}

export async function setRecurringFeeStatus(
  feeId: string,
  status: 'active' | 'paused' | 'cancelled',
  condominiumId?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };
  if (!feeId) return { error: 'Cuota inválida.' };

  const condoResult = await resolveCondoId(condominiumId);
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { error } = await supabase
    .from('recurring_fees')
    .update({ status })
    .eq('id', feeId)
    .eq('condominium_id', condoId);

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

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  let unitsQuery = supabase
    .from('units')
    .select('id, coefficient')
    .eq('condominium_id', condoId);

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
      condominium_id: condoId,
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
      condominium_id: condoId,
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

export async function cancelFeeCampaign(campaignId: string, condominiumId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };
  if (!campaignId) return { error: 'Cuota inválida.' };

  const condoResult = await resolveCondoId(condominiumId);
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { error: campaignError } = await supabase
    .from('fee_campaigns')
    .update({ status: 'cancelled' })
    .eq('id', campaignId)
    .eq('condominium_id', condoId);

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

export async function createIncome(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;
  const clusterId = String(formData.get('cluster_id') ?? '').trim();
  const concept = String(formData.get('concept') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const category = String(formData.get('category') ?? 'otros');
  const incomeDate = String(formData.get('income_date') ?? '');
  const fundType = String(formData.get('fund_type') ?? 'operating') as FundType;
  const notes = String(formData.get('notes') ?? '').trim();

  if (!concept) return { error: 'Concepto obligatorio.' };
  if (!amount || amount <= 0) return { error: 'Monto inválido.' };
  if (!INCOME_CATEGORIES.includes(category as IncomeCategory)) return { error: 'Categoría inválida.' };
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };
  if (!incomeDate) return { error: 'Fecha obligatoria.' };

  const { error } = await supabase.from('income_entries').insert({
    condominium_id: condominiumId,
    cluster_id: clusterId || null,
    concept,
    amount,
    category,
    income_date: incomeDate,
    fund_type: fundType,
    notes: notes || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  await reconcileCondominiumFundBalances(supabase, condominiumId);

  revalidatePath('/finanzas');
  return { success: true };
}

export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;
  const clusterId = String(formData.get('cluster_id') ?? '').trim();
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
      condominium_id: condominiumId,
      cluster_id: clusterId || null,
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

  await reconcileCondominiumFundBalances(supabase, condominiumId);

  revalidatePath('/finanzas');
  return { success: true };
}

export async function saveAnnualBudget(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const fiscalYear = Number(formData.get('fiscal_year'));
  const fundType = String(formData.get('fund_type') ?? 'operating') as FundType;
  const notes = String(formData.get('notes') ?? '').trim();

  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    return { error: 'Año fiscal inválido.' };
  }
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const lines: { line_kind: 'expense' | 'income'; category: string; annual_amount: number }[] = [];

  for (const category of EXPENSE_CATEGORIES) {
    const raw = String(formData.get(`expense_${category}`) ?? '');
    const amount = parseBudgetAmount(raw);
    if (amount === null) return { error: `Monto inválido en egreso: ${category}.` };
    if (amount > 0) lines.push({ line_kind: 'expense', category, annual_amount: amount });
  }

  for (const category of INCOME_CATEGORIES) {
    const raw = String(formData.get(`income_${category}`) ?? '');
    const amount = parseBudgetAmount(raw);
    if (amount === null) return { error: `Monto inválido en ingreso: ${category}.` };
    if (amount > 0) lines.push({ line_kind: 'income', category, annual_amount: amount });
  }

  const { data: budget, error: budgetError } = await supabase
    .from('annual_budgets')
    .upsert(
      {
        condominium_id: condominiumId,
        fiscal_year: fiscalYear,
        fund_type: fundType,
        notes: notes || null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'condominium_id,fiscal_year,fund_type' },
    )
    .select('id')
    .single();

  if (budgetError || !budget) {
    return { error: budgetError?.message ?? 'No se pudo guardar el presupuesto.' };
  }

  const { error: deleteError } = await supabase.from('budget_lines').delete().eq('budget_id', budget.id);
  if (deleteError) return { error: deleteError.message };

  if (lines.length > 0) {
    const { error: linesError } = await supabase.from('budget_lines').insert(
      lines.map((line) => ({
        budget_id: budget.id,
        line_kind: line.line_kind,
        category: line.category,
        annual_amount: line.annual_amount,
      })),
    );
    if (linesError) return { error: linesError.message };
  }

  revalidatePath('/finanzas');
  return { success: true };
}

export async function saveLateFeeSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const enabled = formData.get('enabled') === 'on' || formData.get('enabled') === 'true';
  const graceDays = Number(formData.get('grace_days'));
  const feeType = String(formData.get('fee_type') ?? 'fixed');
  const feeValue = Number(formData.get('fee_value'));
  const applyMode = String(formData.get('apply_mode') ?? 'once');
  const fundType = String(formData.get('fund_type') ?? 'operating') as FundType;
  const notes = String(formData.get('notes') ?? '').trim();

  if (!Number.isInteger(graceDays) || graceDays < 0) {
    return { error: 'Los días de gracia deben ser un número entero mayor o igual a 0.' };
  }
  if (!LATE_FEE_TYPES.includes(feeType as (typeof LATE_FEE_TYPES)[number])) {
    return { error: 'Tipo de recargo inválido.' };
  }
  if (!LATE_FEE_APPLY_MODES.includes(applyMode as (typeof LATE_FEE_APPLY_MODES)[number])) {
    return { error: 'Modo de aplicación inválido.' };
  }
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };
  if (enabled) {
    if (!Number.isFinite(feeValue) || feeValue <= 0) {
      return { error: 'Indica un monto o porcentaje mayor a 0 para activar recargos.' };
    }
    if (feeType === 'percent' && feeValue > 100) {
      return { error: 'El porcentaje no puede ser mayor a 100.' };
    }
  }

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { error } = await supabase.from('late_fee_settings').upsert(
    {
      condominium_id: condoId,
      enabled,
      grace_days: graceDays,
      fee_type: feeType,
      fee_value: enabled ? feeValue : 0,
      apply_mode: applyMode,
      fund_type: fundType,
      notes: notes || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'condominium_id' },
  );

  if (error) return { error: error.message };

  if (enabled) {
    await ensureLateFeesForCondo(supabase, condoId, user.id);
  }

  revalidatePath('/finanzas');
  return { success: true };
}

export async function saveOverdueReminderRule(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const enabled = formData.get('reminder_enabled') === 'on' || formData.get('reminder_enabled') === 'true';
  const daysAfter = Number(formData.get('days_after'));
  const notifyPush =
    formData.get('notify_push') === 'on' || formData.get('notify_push') === 'true';
  const notifyEmail =
    formData.get('notify_email') === 'on' || formData.get('notify_email') === 'true';

  if (!Number.isInteger(daysAfter) || daysAfter < 1 || daysAfter > 365) {
    return { error: 'Los días después del vencimiento deben estar entre 1 y 365.' };
  }
  if (enabled && !notifyPush && !notifyEmail) {
    return { error: 'Activa al menos un canal: push o correo.' };
  }

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { error } = await supabase.from('notification_rules').upsert(
    {
      condominium_id: condoId,
      rule_key: 'charge_overdue_reminder',
      days_before: null,
      days_after: daysAfter,
      is_enabled: enabled,
      notify_push: notifyPush,
      notify_email: notifyEmail,
    },
    { onConflict: 'condominium_id,rule_key' },
  );

  if (error) return { error: error.message };

  revalidatePath('/finanzas');
  return { success: true };
}

export async function sendPaymentReminder(chargeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const { data: charge, error: chargeError } = await supabase
    .from('charges')
    .select('id, unit_id, concept, amount, due_date, status, condominium_id')
    .eq('id', chargeId)
    .single();

  if (chargeError || !charge) return { error: 'Cargo no encontrado.' };
  if (charge.status === 'paid' || charge.status === 'cancelled') {
    return { error: 'Este cargo ya no está pendiente de cobro.' };
  }

  const { data: rule } = await supabase
    .from('notification_rules')
    .select('notify_push, notify_email')
    .eq('condominium_id', charge.condominium_id)
    .eq('rule_key', 'charge_overdue_reminder')
    .maybeSingle();

  const delivery = await deliverChargeReminder({
    condominiumId: charge.condominium_id,
    unitId: charge.unit_id,
    chargeId: charge.id,
    concept: charge.concept,
    amount: Number(charge.amount),
    dueDate: charge.due_date,
    notifyPush: rule?.notify_push ?? true,
    notifyEmail: rule?.notify_email ?? true,
    source: 'manual',
  });

  const message = `Recordatorio de pago: ${charge.concept} por $${Number(charge.amount).toFixed(2)} (vence ${charge.due_date}).`;
  const channel =
    delivery.pushSent > 0 && delivery.emailSent > 0
      ? 'manual'
      : delivery.pushSent > 0
        ? 'push'
        : delivery.emailSent > 0
          ? 'email'
          : 'manual';

  const { error } = await supabase.from('payment_reminder_log').insert({
    condominium_id: charge.condominium_id,
    unit_id: charge.unit_id,
    charge_id: charge.id,
    channel,
    message,
    sent_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/finanzas');

  if (delivery.pushSent === 0 && delivery.emailSent === 0) {
    return {
      success: true,
      message:
        delivery.skipped > 0
          ? 'Recordatorio registrado. Sin dispositivo push ni correo disponible para esta unidad.'
          : 'Recordatorio registrado, pero no se pudo entregar por ningún canal.',
    };
  }

  const parts: string[] = [];
  if (delivery.pushSent > 0) parts.push(`${delivery.pushSent} push`);
  if (delivery.emailSent > 0) parts.push(`${delivery.emailSent} correo`);
  return {
    success: true,
    message: `Recordatorio enviado (${parts.join(', ')}).`,
  };
}

export async function saveFundOpeningBalance(
  condominiumId: string,
  fundType: FundType,
  openingBalance: number,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };
  if (!Number.isFinite(openingBalance)) return { error: 'Monto inválido.' };

  const condoResult = await resolveCondoId(condominiumId);
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { error: upsertError } = await supabase.from('fund_balances').upsert(
    {
      condominium_id: condoId,
      fund_type: fundType,
      opening_balance: openingBalance,
      as_of_date: new Date().toISOString().slice(0, 10),
    },
    { onConflict: 'condominium_id,fund_type' },
  );

  if (upsertError) return { error: upsertError.message };

  await reconcileCondominiumFundBalances(supabase, condoId);

  revalidatePath('/finanzas');
  return { success: true };
}

export async function forgiveCharge(chargeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };
  if (!chargeId) return { error: 'Cargo inválido.' };

  const { data: charge, error: chargeError } = await supabase
    .from('charges')
    .select('id, status, charge_kind, condominium_id')
    .eq('id', chargeId)
    .single();

  if (chargeError || !charge) return { error: 'Cargo no encontrado.' };
  if (charge.status === 'paid') return { error: 'Este cargo ya está pagado.' };
  if (charge.status === 'forgiven') return { error: 'Este cargo ya fue condonado.' };
  if (charge.status === 'cancelled') return { error: 'Este cargo está cancelado.' };

  const { error: updateError } = await supabase
    .from('charges')
    .update({ status: 'forgiven', updated_at: new Date().toISOString() })
    .eq('id', chargeId);

  if (updateError) return { error: updateError.message };

  if (charge.charge_kind === 'principal') {
    await supabase
      .from('charges')
      .update({ status: 'forgiven', updated_at: new Date().toISOString() })
      .eq('parent_charge_id', chargeId)
      .in('status', ['pending', 'overdue']);
  }

  revalidatePath('/finanzas');
  return { success: true };
}

export async function createPaymentPlan(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;
  const unitId = String(formData.get('unit_id') ?? '').trim();
  const chargeIds = formData.getAll('charge_id').map((value) => String(value)).filter(Boolean);
  const installmentCount = Number(formData.get('installment_count'));
  const firstDueDate = String(formData.get('first_due_date') ?? '').trim();
  const intervalMonths = Number(formData.get('interval_months') || 1);
  const title = String(formData.get('title') ?? 'Plan de pago').trim() || 'Plan de pago';
  const notes = String(formData.get('notes') ?? '').trim();

  if (!unitId) return { error: 'Selecciona una unidad.' };
  if (!chargeIds.length) return { error: 'Selecciona al menos un cargo.' };
  if (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 36) {
    return { error: 'El plan debe tener entre 2 y 36 parcialidades.' };
  }
  if (!firstDueDate) return { error: 'Indica la fecha de la primera parcialidad.' };
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || intervalMonths > 12) {
    return { error: 'El intervalo entre parcialidades debe ser de 1 a 12 meses.' };
  }

  const { data: existingPlan } = await supabase
    .from('payment_plans')
    .select('id')
    .eq('unit_id', unitId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingPlan) {
    return { error: 'Esta unidad ya tiene un plan de pago activo. Cancélalo antes de crear otro.' };
  }

  const { data: charges, error: chargesError } = await supabase
    .from('charges')
    .select('id, unit_id, amount, amount_paid, status')
    .eq('unit_id', unitId)
    .in('id', chargeIds);

  if (chargesError) return { error: chargesError.message };
  if (!charges?.length || charges.length !== chargeIds.length) {
    return { error: 'Uno o más cargos no pertenecen a la unidad seleccionada.' };
  }

  let totalAmount = 0;
  const linkRows: { charge_id: string; balance_at_start: number }[] = [];

  for (const charge of charges) {
    const balance = chargeBalanceDue({
      amount: Number(charge.amount),
      amount_paid: Number(charge.amount_paid ?? 0),
      status: charge.status,
    });
    if (balance <= 0) {
      return { error: 'Solo puedes incluir cargos con saldo pendiente.' };
    }
    totalAmount += balance;
    linkRows.push({ charge_id: charge.id, balance_at_start: balance });
  }

  totalAmount = Math.round(totalAmount * 100) / 100;
  let schedule;
  try {
    schedule = buildInstallmentSchedule(totalAmount, installmentCount, firstDueDate, intervalMonths);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo calcular el plan.' };
  }

  const { data: plan, error: planError } = await supabase
    .from('payment_plans')
    .insert({
      condominium_id: condoId,
      unit_id: unitId,
      title,
      notes: notes || null,
      total_amount: totalAmount,
      status: 'active',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (planError || !plan) {
    return { error: planError?.message ?? 'No se pudo crear el plan de pago.' };
  }

  const { error: installmentsError } = await supabase.from('payment_plan_installments').insert(
    schedule.map((row) => ({
      plan_id: plan.id,
      installment_number: row.installmentNumber,
      due_date: row.dueDate,
      amount: row.amount,
    })),
  );

  if (installmentsError) {
    await supabase.from('payment_plans').delete().eq('id', plan.id);
    return { error: installmentsError.message };
  }

  const { error: linksError } = await supabase.from('payment_plan_charges').insert(
    linkRows.map((row) => ({
      plan_id: plan.id,
      charge_id: row.charge_id,
      balance_at_start: row.balance_at_start,
    })),
  );

  if (linksError) {
    await supabase.from('payment_plans').delete().eq('id', plan.id);
    return { error: linksError.message };
  }

  revalidatePath('/finanzas');
  revalidatePath('/mi-cuenta');
  return { success: true };
}

export async function cancelPaymentPlan(planId: string, condominiumId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };
  if (!planId) return { error: 'Plan inválido.' };

  const condoResult = await resolveCondoId(condominiumId);
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { data: plan, error: planError } = await supabase
    .from('payment_plans')
    .select('id, status')
    .eq('id', planId)
    .eq('condominium_id', condoId)
    .single();

  if (planError || !plan) return { error: 'Plan no encontrado.' };
  if (plan.status !== 'active') return { error: 'Solo se pueden cancelar planes activos.' };

  const { error: updatePlanError } = await supabase
    .from('payment_plans')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', planId);

  if (updatePlanError) return { error: updatePlanError.message };

  await supabase
    .from('payment_plan_installments')
    .update({ status: 'cancelled' })
    .eq('plan_id', planId)
    .neq('status', 'paid');

  revalidatePath('/finanzas');
  revalidatePath('/mi-cuenta');
  return { success: true };
}

export async function saveDueSoonReminderRule(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const enabled =
    formData.get('due_soon_enabled') === 'on' || formData.get('due_soon_enabled') === 'true';
  const daysBefore = Number(formData.get('days_before'));
  const notifyPush =
    formData.get('due_soon_notify_push') === 'on' || formData.get('due_soon_notify_push') === 'true';
  const notifyEmail =
    formData.get('due_soon_notify_email') === 'on' || formData.get('due_soon_notify_email') === 'true';

  if (!Number.isInteger(daysBefore) || daysBefore < 1 || daysBefore > 60) {
    return { error: 'Los días antes del vencimiento deben estar entre 1 y 60.' };
  }
  if (enabled && !notifyPush && !notifyEmail) {
    return { error: 'Activa al menos un canal: push o correo.' };
  }

  const condoResult = await resolveCondoId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condoId = condoResult;

  const { error } = await supabase.from('notification_rules').upsert(
    {
      condominium_id: condoId,
      rule_key: 'charge_due_soon',
      days_before: daysBefore,
      days_after: null,
      is_enabled: enabled,
      notify_push: notifyPush,
      notify_email: notifyEmail,
    },
    { onConflict: 'condominium_id,rule_key' },
  );

  if (error) return { error: error.message };

  revalidatePath('/finanzas');
  return { success: true };
}

export async function runFinanceMaintenanceNow() {
  const denied = await assertAdminAction();
  if (denied) return denied;

  try {
    const result = await runDailyFinanceMaintenance();
    revalidatePath('/finanzas');
    return { success: true, result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo ejecutar el mantenimiento.' };
  }
}