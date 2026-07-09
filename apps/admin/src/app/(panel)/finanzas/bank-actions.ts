'use server';

import { revalidatePath } from 'next/cache';
import {
  detectBankImportFormat,
  ofxAccountLast4,
  parseBankImportContent,
  parseOfxAccountInfo,
  roundMoney,
} from '@veka/shared';

import { requireActiveCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

function normalizeClabe(value: string): string {
  return value.replace(/\s+/g, '');
}

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
  const clabe = normalizeClabe(String(formData.get('clabe') ?? '').trim());

  if (!name) return { error: 'Nombre de cuenta obligatorio.' };
  if (clabe && !/^\d{18}$/.test(clabe)) {
    return { error: 'La CLABE debe tener exactamente 18 dígitos.' };
  }

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
      if (account?.account_last4 && ofxLast4 && account.account_last4 !== ofxLast4) {
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

async function loadMatchTargetAmount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchType: 'payment' | 'income' | 'expense',
  paymentId: string,
  incomeEntryId: string,
  expenseId: string,
): Promise<{ amount: number } | { error: string }> {
  if (matchType === 'payment') {
    if (!paymentId) return { error: 'Selecciona un pago.' };
    const { data, error } = await supabase.from('payments').select('amount').eq('id', paymentId).maybeSingle();
    if (error || !data) return { error: 'Pago no encontrado.' };
    return { amount: Number(data.amount) };
  }
  if (matchType === 'income') {
    if (!incomeEntryId) return { error: 'Selecciona un ingreso.' };
    const { data, error } = await supabase
      .from('income_entries')
      .select('amount')
      .eq('id', incomeEntryId)
      .maybeSingle();
    if (error || !data) return { error: 'Ingreso no encontrado.' };
    return { amount: Number(data.amount) };
  }
  if (!expenseId) return { error: 'Selecciona un egreso.' };
  const { data, error } = await supabase.from('expenses').select('amount').eq('id', expenseId).maybeSingle();
  if (error || !data) return { error: 'Egreso no encontrado.' };
  return { amount: Number(data.amount) };
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
  if (!['payment', 'income', 'expense'].includes(matchType)) {
    return { error: 'Tipo de conciliación inválido.' };
  }

  const { data: bankTx, error: bankError } = await supabase
    .from('bank_transactions')
    .select('id, amount, status')
    .eq('id', bankTransactionId)
    .maybeSingle();

  if (bankError || !bankTx) return { error: 'Movimiento bancario no encontrado.' };
  if (bankTx.status !== 'unmatched') {
    return { error: 'Este movimiento ya está conciliado o ignorado.' };
  }

  const target = await loadMatchTargetAmount(supabase, matchType, paymentId, incomeEntryId, expenseId);
  if ('error' in target) return target;

  const bankAmount = Number(bankTx.amount);
  const targetAmount = Number(target.amount);
  const absBank = Math.abs(bankAmount);
  const absTarget = Math.abs(targetAmount);

  if (roundMoney(Math.abs(absBank - absTarget)) > 0.01) {
    return {
      error: `El monto no coincide (banco ${absBank.toFixed(2)} vs libro ${absTarget.toFixed(2)}).`,
    };
  }

  if (matchType === 'expense' && bankAmount > 0.01) {
    return { error: 'Un egreso debe conciliarse con un movimiento bancario de salida (monto negativo).' };
  }
  if ((matchType === 'payment' || matchType === 'income') && bankAmount < -0.01) {
    return { error: 'Un ingreso/pago debe conciliarse con un movimiento bancario de entrada (monto positivo).' };
  }

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
