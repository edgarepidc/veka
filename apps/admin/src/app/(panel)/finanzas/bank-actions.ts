'use server';

import { revalidatePath } from 'next/cache';
import {
  detectBankImportFormat,
  ofxAccountLast4,
  parseBankImportContent,
  parseOfxAccountInfo,
} from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export async function saveBankAccount(formData: FormData) {
  const condoResult = await requireActiveCondominiumId(String(formData.get('condominium_id') ?? ''));
  if (typeof condoResult !== 'string') return { error: condoResult.error };
  const condominiumId = condoResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

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
  const content = String(formData.get('import_content') ?? formData.get('csv') ?? '').trim();
  const formatInput = String(formData.get('format') ?? 'auto').trim();

  if (!bankAccountId) return { error: 'Selecciona una cuenta bancaria.' };
  if (!content) return { error: 'Pega o sube un archivo CSV u OFX para importar.' };

  const format =
    formatInput === 'csv' || formatInput === 'ofx'
      ? (formatInput as 'csv' | 'ofx')
      : ('auto' as const);

  let rows;
  try {
    rows = parseBankImportContent(content, format);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'No se pudo interpretar el archivo bancario.',
    };
  }

  if (rows.length === 0) {
    return { error: 'No se encontraron movimientos válidos en el archivo.' };
  }

  const detectedFormat = format === 'auto' ? detectBankImportFormat(content) : format;
  let accountWarning: string | undefined;

  if (detectedFormat === 'ofx') {
    const ofxAccount = parseOfxAccountInfo(content);
    if (ofxAccount?.accountId) {
      const { data: account } = await supabase
        .from('bank_accounts')
        .select('account_last4')
        .eq('id', bankAccountId)
        .maybeSingle();

      const ofxLast4 = ofxAccountLast4(ofxAccount.accountId);
      if (
        account?.account_last4 &&
        ofxLast4 &&
        account.account_last4 !== ofxLast4
      ) {
        accountWarning = `El archivo OFX corresponde a una cuenta terminada en ${ofxLast4}, distinta a la seleccionada (···${account.account_last4}).`;
      }
    }
  }

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
  return {
    success: true,
    imported: rows.length,
    format: detectedFormat,
    warning: accountWarning,
  };
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
