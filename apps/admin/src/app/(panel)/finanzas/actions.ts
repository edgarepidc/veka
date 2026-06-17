'use server';

import { revalidatePath } from 'next/cache';
import type { ExpenseKind, ExpenseStatus, FundType } from '@veka/shared';
import { EXPENSE_CATEGORIES, EXPENSE_KINDS, EXPENSE_STATUSES, FUND_TYPES } from '@veka/shared';

import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

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
