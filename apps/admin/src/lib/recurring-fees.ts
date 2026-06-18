import type { SupabaseClient } from '@supabase/supabase-js';
import {
  currentPeriodMonth,
  dueDateForPeriodMonth,
  periodLabel,
  resolveBaseAmount,
  unitChargeAmount,
  type FeeRevision,
} from '@veka/shared';

interface RecurringFeeRow {
  id: string;
  condominium_id: string;
  cluster_id: string | null;
  scope: 'general' | 'cluster';
  concept: string;
  due_day: number;
  fund_type: string;
  status: string;
}

export async function generateChargesForRecurringFee(
  supabase: SupabaseClient,
  fee: RecurringFeeRow,
  periodMonth: string,
  userId?: string | null,
): Promise<number> {
  if (fee.status !== 'active') return 0;

  const { data: revisions } = await supabase
    .from('recurring_fee_revisions')
    .select('base_amount, effective_from')
    .eq('recurring_fee_id', fee.id)
    .order('effective_from', { ascending: false });

  const baseAmount = resolveBaseAmount((revisions ?? []) as FeeRevision[], periodMonth);
  if (!baseAmount) return 0;

  let unitsQuery = supabase
    .from('units')
    .select('id, coefficient')
    .eq('condominium_id', fee.condominium_id);

  if (fee.scope === 'cluster' && fee.cluster_id) {
    unitsQuery = unitsQuery.eq('cluster_id', fee.cluster_id);
  }

  const { data: units, error: unitsError } = await unitsQuery;
  if (unitsError || !units?.length) return 0;

  const { data: existing } = await supabase
    .from('charges')
    .select('unit_id')
    .eq('recurring_fee_id', fee.id)
    .eq('period_month', periodMonth);

  const existingUnits = new Set((existing ?? []).map((row) => row.unit_id));
  const pendingUnits = units.filter((unit) => !existingUnits.has(unit.id));
  if (pendingUnits.length === 0) return 0;

  const dueDate = dueDateForPeriodMonth(periodMonth, fee.due_day);
  const concept = `${fee.concept} — ${periodLabel(periodMonth)}`;

  const { error } = await supabase.from('charges').insert(
    pendingUnits.map((unit) => ({
      condominium_id: fee.condominium_id,
      unit_id: unit.id,
      recurring_fee_id: fee.id,
      concept,
      amount: unitChargeAmount(baseAmount, Number(unit.coefficient ?? 1)),
      fund_type: fee.fund_type,
      due_date: dueDate,
      period_month: periodMonth,
      status: 'pending' as const,
      created_by: userId ?? null,
    })),
  );

  if (error) throw new Error(error.message);
  return pendingUnits.length;
}

export async function ensureRecurringChargesForCondo(
  supabase: SupabaseClient,
  condominiumId: string,
  userId?: string | null,
  periodMonth = currentPeriodMonth(),
): Promise<number> {
  const { data: fees, error } = await supabase
    .from('recurring_fees')
    .select('id, condominium_id, cluster_id, scope, concept, due_day, fund_type, status')
    .eq('condominium_id', condominiumId)
    .eq('status', 'active');

  if (error) throw new Error(error.message);

  let generated = 0;
  for (const fee of fees ?? []) {
    generated += await generateChargesForRecurringFee(
      supabase,
      fee as RecurringFeeRow,
      periodMonth,
      userId,
    );
  }
  return generated;
}

export async function recurringFeeHasChargesForPeriod(
  supabase: SupabaseClient,
  recurringFeeId: string,
  periodMonth: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('charges')
    .select('id', { count: 'exact', head: true })
    .eq('recurring_fee_id', recurringFeeId)
    .eq('period_month', periodMonth);

  return (count ?? 0) > 0;
}
