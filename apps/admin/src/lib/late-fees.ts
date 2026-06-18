import type { SupabaseClient } from '@supabase/supabase-js';
import {
  lateFeesToCreate,
  type ChargeForLateFee,
  type ExistingLateFee,
  type LateFeeSettings,
} from '@veka/shared';

const DEFAULT_SETTINGS: LateFeeSettings = {
  enabled: false,
  grace_days: 0,
  fee_type: 'fixed',
  fee_value: 0,
  apply_mode: 'once',
  fund_type: 'operating',
};

export async function loadLateFeeSettings(
  supabase: SupabaseClient,
  condominiumId: string,
): Promise<LateFeeSettings> {
  const { data } = await supabase
    .from('late_fee_settings')
    .select('enabled, grace_days, fee_type, fee_value, apply_mode, fund_type, notes')
    .eq('condominium_id', condominiumId)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS;

  return {
    enabled: Boolean(data.enabled),
    grace_days: Number(data.grace_days),
    fee_type: data.fee_type as LateFeeSettings['fee_type'],
    fee_value: Number(data.fee_value),
    apply_mode: data.apply_mode as LateFeeSettings['apply_mode'],
    fund_type: data.fund_type as LateFeeSettings['fund_type'],
    notes: data.notes,
  };
}

export async function ensureLateFeesForCondo(
  supabase: SupabaseClient,
  condominiumId: string,
  userId?: string | null,
): Promise<number> {
  const settings = await loadLateFeeSettings(supabase, condominiumId);
  if (!settings.enabled) return 0;

  const { data: principals, error: principalsError } = await supabase
    .from('charges')
    .select('id, unit_id, concept, amount, due_date, status, charge_kind, fund_type')
    .eq('condominium_id', condominiumId)
    .eq('charge_kind', 'principal')
    .in('status', ['pending', 'overdue']);

  if (principalsError || !principals?.length) return 0;

  const principalIds = principals.map((charge) => charge.id);
  let existingLateFees: ExistingLateFee[] = [];

  if (principalIds.length > 0) {
    const { data } = await supabase
      .from('charges')
      .select('id, parent_charge_id, period_month')
      .eq('condominium_id', condominiumId)
      .eq('charge_kind', 'late_fee')
      .in('parent_charge_id', principalIds);
    existingLateFees = (data ?? []) as ExistingLateFee[];
  }

  const lateFeesByParent = new Map<string, ExistingLateFee[]>();
  for (const fee of existingLateFees) {
    const parentId = fee.parent_charge_id as string;
    const list = lateFeesByParent.get(parentId) ?? [];
    list.push(fee as ExistingLateFee);
    lateFeesByParent.set(parentId, list);
  }

  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const principal of principals as ChargeForLateFee[]) {
    const pending = lateFeesToCreate(
      principal,
      settings,
      lateFeesByParent.get(principal.id) ?? [],
    );

    for (const fee of pending) {
      const { error } = await supabase.from('charges').insert({
        condominium_id: condominiumId,
        unit_id: principal.unit_id,
        parent_charge_id: principal.id,
        charge_kind: 'late_fee',
        concept: fee.concept,
        amount: fee.amount,
        fund_type: settings.fund_type,
        due_date: today,
        status: 'overdue',
        period_month: fee.periodMonth,
        created_by: userId ?? null,
      });

      if (!error) created += 1;
    }
  }

  return created;
}
