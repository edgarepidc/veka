'use server';

import { revalidatePath } from 'next/cache';

import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

function resolveCondoId(value?: string | null): string {
  const id = value?.trim();
  return id || DEMO_CONDO_ID;
}

function parseCsvTransactions(csv: string): {
  transaction_date: string;
  amount: number;
  description: string;
  reference: string;
  external_id: string;
}[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const rows = lines.slice(lines[0].toLowerCase().includes('fecha') ? 1 : 0);
  const parsed: ReturnType<typeof parseCsvTransactions> = [];

  for (const [index, line] of rows.entries()) {
    const parts = line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) continue;

    const dateRaw = parts[0];
    const amountRaw = parts[1].replace(/[$,\s]/g, '');
    const amount = Number(amountRaw);
    if (!dateRaw || !Number.isFinite(amount)) continue;

    const isoDate = dateRaw.includes('-')
      ? dateRaw.slice(0, 10)
      : dateRaw.split('/').reverse().join('-').slice(0, 10);

    parsed.push({
      transaction_date: isoDate,
      amount,
      description: parts[2] ?? '',
      reference: parts[3] ?? '',
      external_id: parts[4] ?? `import-${isoDate}-${amount}-${index}`,
    });
  }

  return parsed;
}

export async function saveBankAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const condominiumId = resolveCondoId(String(formData.get('condominium_id') ?? ''));
  const name = String(formData.get('name') ?? '').trim();
  const bankName = String(formData.get('bank_name') ?? '').trim();
  const accountLast4 = String(formData.get('account_last4') ?? '').trim();
  const clabe = String(formData.get('clabe') ?? '').trim();

  if (!name) return { error: 'Nombre de cuenta obligatorio.' };

  const { error } = await supabase.from('bank_accounts').insert({
    condominium_id: condominiumId,
    name,
    bank_name: bankName || null,
    account_last4: accountLast4 || null,
    clabe: clabe || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/finanzas');
  return { success: true };
}

export async function importBankTransactions(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const bankAccountId = String(formData.get('bank_account_id') ?? '').trim();
  const csv = String(formData.get('csv') ?? '').trim();
  if (!bankAccountId) return { error: 'Selecciona una cuenta bancaria.' };
  if (!csv) return { error: 'Pega el contenido CSV a importar.' };

  const rows = parseCsvTransactions(csv);
  if (rows.length === 0) return { error: 'No se encontraron movimientos válidos en el CSV.' };

  const { error } = await supabase.from('bank_transactions').upsert(
    rows.map((row) => ({
      bank_account_id: bankAccountId,
      transaction_date: row.transaction_date,
      amount: row.amount,
      description: row.description || null,
      reference: row.reference || null,
      external_id: row.external_id,
      status: 'unmatched',
    })),
    { onConflict: 'bank_account_id,external_id' },
  );

  if (error) return { error: error.message };
  revalidatePath('/finanzas');
  return { success: true, imported: rows.length };
}

export async function matchBankTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const bankTransactionId = String(formData.get('bank_transaction_id') ?? '').trim();
  const matchType = String(formData.get('match_type') ?? '') as 'payment' | 'income' | 'expense';
  const paymentId = String(formData.get('payment_id') ?? '').trim();
  const incomeEntryId = String(formData.get('income_entry_id') ?? '').trim();
  const expenseId = String(formData.get('expense_id') ?? '').trim();

  if (!bankTransactionId || !matchType) return { error: 'Datos incompletos.' };

  const { error: matchError } = await supabase.from('bank_reconciliation_matches').upsert(
    {
      bank_transaction_id: bankTransactionId,
      match_type: matchType,
      payment_id: matchType === 'payment' ? paymentId || null : null,
      income_entry_id: matchType === 'income' ? incomeEntryId || null : null,
      expense_id: matchType === 'expense' ? expenseId || null : null,
      matched_by: user.id,
      matched_at: new Date().toISOString(),
    },
    { onConflict: 'bank_transaction_id' },
  );

  if (matchError) return { error: matchError.message };

  const { error: statusError } = await supabase
    .from('bank_transactions')
    .update({ status: 'matched' })
    .eq('id', bankTransactionId);

  if (statusError) return { error: statusError.message };

  revalidatePath('/finanzas');
  return { success: true };
}

export async function ignoreBankTransaction(bankTransactionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const { error } = await supabase
    .from('bank_transactions')
    .update({ status: 'ignored' })
    .eq('id', bankTransactionId);

  if (error) return { error: error.message };
  revalidatePath('/finanzas');
  return { success: true };
}

export async function unmatchBankTransaction(bankTransactionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const { error: deleteError } = await supabase
    .from('bank_reconciliation_matches')
    .delete()
    .eq('bank_transaction_id', bankTransactionId);

  if (deleteError) return { error: deleteError.message };

  const { error: statusError } = await supabase
    .from('bank_transactions')
    .update({ status: 'unmatched' })
    .eq('id', bankTransactionId);

  if (statusError) return { error: statusError.message };

  revalidatePath('/finanzas');
  return { success: true };
}
