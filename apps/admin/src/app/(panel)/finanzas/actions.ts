'use server';

import { revalidatePath } from 'next/cache';
import type { ExpenseKind, ExpenseStatus, FeeScope, FundType } from '@veka/shared';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  EXPENSE_STATUSES,
  FEE_SCOPES,
  FUND_TYPES,
} from '@veka/shared';

import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export async function createFeeCampaign(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autorizado' };

  const scope = String(formData.get('scope') ?? '') as FeeScope;
  const clusterId = String(formData.get('cluster_id') ?? '').trim();
  const concept = String(formData.get('concept') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const dueDate = String(formData.get('due_date') ?? '');
  const fundType = String(formData.get('fund_type') ?? 'operating') as FundType;
  const periodMonth = String(formData.get('period_month') ?? '').trim();

  if (!FEE_SCOPES.includes(scope)) return { error: 'Tipo de cuota inválido.' };
  if (!concept) return { error: 'Concepto obligatorio.' };
  if (!amount || amount <= 0) return { error: 'Monto inválido.' };
  if (!dueDate) return { error: 'Fecha de vencimiento obligatoria.' };
  if (!FUND_TYPES.includes(fundType)) return { error: 'Fondo inválido.' };
  if (scope === 'cluster' && !clusterId) return { error: 'Selecciona la torre o cluster.' };

  let unitsQuery = supabase
    .from('units')
    .select('id')
    .eq('condominium_id', DEMO_CONDO_ID);

  if (scope === 'cluster') {
    unitsQuery = unitsQuery.eq('cluster_id', clusterId);
  } else if (scope === 'extraordinary' && clusterId) {
    unitsQuery = unitsQuery.eq('cluster_id', clusterId);
  }

  const { data: units, error: unitsError } = await unitsQuery;
  if (unitsError) return { error: unitsError.message };
  if (!units?.length) return { error: 'No hay unidades en el alcance seleccionado.' };

  const { data: campaign, error: campaignError } = await supabase
    .from('fee_campaigns')
    .insert({
      condominium_id: DEMO_CONDO_ID,
      cluster_id: scope === 'general' ? null : clusterId || null,
      scope,
      concept,
      amount,
      fund_type: fundType,
      due_date: dueDate,
      period_month: periodMonth || null,
      status: 'active',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (campaignError || !campaign) {
    return { error: campaignError?.message ?? 'No se pudo crear la cuota.' };
  }

  const { error: chargesError } = await supabase.from('charges').insert(
    units.map((unit) => ({
      condominium_id: DEMO_CONDO_ID,
      unit_id: unit.id,
      fee_campaign_id: campaign.id,
      concept,
      amount,
      fund_type: fundType,
      due_date: dueDate,
      period_month: periodMonth || null,
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
