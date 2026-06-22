'use client';

import { useMemo, useState, useTransition } from 'react';
import { formatCurrency } from '@veka/shared';

import {
  importBankTransactions,
  ignoreBankTransaction,
  matchBankTransaction,
  saveBankAccount,
} from '@/app/(panel)/finanzas/bank-actions';
import { GlassCard } from '@/components/ui/GlassCard';

interface BankAccountRow {
  id: string;
  name: string;
  bank_name: string | null;
  account_last4: string | null;
}

interface BankTransactionRow {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  reference: string | null;
  status: string;
}

interface PaymentCandidate {
  id: string;
  amount: number;
  paid_at: string | null;
  created_at: string;
  charge: { concept: string } | null;
}

interface IncomeCandidate {
  id: string;
  amount: number;
  concept: string;
  income_date: string;
}

interface ExpenseCandidate {
  id: string;
  amount: number;
  concept: string;
  expense_date: string;
}

export function BankReconciliationPanel({
  condominiumId,
  bankAccounts,
  bankTransactions,
  payments,
  incomeEntries,
  expenses,
  onReload,
}: {
  condominiumId: string;
  bankAccounts: BankAccountRow[];
  bankTransactions: BankTransactionRow[];
  payments: PaymentCandidate[];
  incomeEntries: IncomeCandidate[];
  expenses: ExpenseCandidate[];
  onReload: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(bankAccounts[0]?.id ?? '');
  const [csv, setCsv] = useState('');

  const unmatched = useMemo(
    () => bankTransactions.filter((row) => row.status === 'unmatched'),
    [bankTransactions],
  );

  function saveAccount() {
    setMessage(null);
    const formData = new FormData();
    formData.set('condominium_id', condominiumId);
    formData.set('name', accountName);
    formData.set('bank_name', bankName);
    formData.set('account_last4', accountLast4);
    startTransition(async () => {
      const result = await saveBankAccount(formData);
      setMessage(result.error ?? 'Cuenta bancaria registrada.');
      if (result.success) {
        setAccountName('');
        setBankName('');
        setAccountLast4('');
        onReload();
      }
    });
  }

  function importCsv() {
    setMessage(null);
    const formData = new FormData();
    formData.set('bank_account_id', selectedAccountId);
    formData.set('csv', csv);
    startTransition(async () => {
      const result = await importBankTransactions(formData);
      setMessage(
        result.error ??
          `Importados ${'imported' in result ? result.imported : 0} movimientos bancarios.`,
      );
      if (result.success) {
        setCsv('');
        onReload();
      }
    });
  }

  function suggestMatch(amount: number) {
    const tolerance = 0.01;
    const payment = payments.find((row) => Math.abs(Number(row.amount) - amount) <= tolerance);
    if (payment) return { type: 'payment' as const, id: payment.id, label: payment.charge?.concept ?? 'Pago' };
    const income = incomeEntries.find((row) => Math.abs(Number(row.amount) - amount) <= tolerance);
    if (income) return { type: 'income' as const, id: income.id, label: income.concept };
    const expense = expenses.find((row) => Math.abs(Number(row.amount) - amount) <= tolerance);
    if (expense) return { type: 'expense' as const, id: expense.id, label: expense.concept };
    return null;
  }

  function matchRow(transactionId: string, type: 'payment' | 'income' | 'expense', targetId: string) {
    const formData = new FormData();
    formData.set('bank_transaction_id', transactionId);
    formData.set('match_type', type);
    if (type === 'payment') formData.set('payment_id', targetId);
    if (type === 'income') formData.set('income_entry_id', targetId);
    if (type === 'expense') formData.set('expense_id', targetId);
    startTransition(async () => {
      const result = await matchBankTransaction(formData);
      setMessage(result.error ?? 'Movimiento conciliado.');
      if (result.success) onReload();
    });
  }

  return (
    <div className="space-y-6">
      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Conciliación bancaria</h2>
        <p className="mt-1 text-sm text-muted">
          Importa movimientos del banco y concílialos con pagos, ingresos o egresos del libro.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
            placeholder="Nombre de cuenta"
            className="glass-input"
          />
          <input
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
            placeholder="Banco"
            className="glass-input"
          />
          <input
            value={accountLast4}
            onChange={(event) => setAccountLast4(event.target.value)}
            placeholder="Últimos 4 dígitos"
            className="glass-input"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={saveAccount}
            disabled={pending}
            className="glass-btn px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Agregar cuenta
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-base font-semibold text-[var(--text)]">Importar CSV</h3>
        <p className="mt-1 text-xs text-subtle">
          Formato: fecha, monto, descripción, referencia (encabezado opcional). Usa coma o punto y coma.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            className="glass-input min-w-[12rem]"
          >
            {bankAccounts.length === 0 ? <option value="">Sin cuentas</option> : null}
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.account_last4 ? ` ···${account.account_last4}` : ''}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={5}
          className="glass-input mt-3 w-full resize-y font-mono text-xs"
          placeholder={'fecha,monto,descripcion,referencia\n2026-06-01,3500.00,SPEI UNIDAD 101,REF123'}
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={importCsv}
            disabled={pending || !selectedAccountId}
            className="glass-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Importar movimientos
          </button>
        </div>
      </GlassCard>

      {message ? (
        <p className={`text-sm ${message.includes('error') || message.includes('obligat') ? 'text-red-300' : 'text-emerald-300'}`}>
          {message}
        </p>
      ) : null}

      <GlassCard>
        <h3 className="text-base font-semibold text-[var(--text)]">
          Pendientes de conciliar ({unmatched.length})
        </h3>
        {unmatched.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">No hay movimientos bancarios sin conciliar.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {unmatched.map((row) => {
              const suggestion = suggestMatch(Number(row.amount));
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      {row.transaction_date} · {formatCurrency(Number(row.amount))}
                    </p>
                    <p className="text-sm text-muted">{row.description || row.reference || 'Sin descripción'}</p>
                    {suggestion ? (
                      <p className="mt-1 text-xs text-emerald-300">
                        Sugerencia: {suggestion.label} ({suggestion.type})
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestion ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => matchRow(row.id, suggestion.type, suggestion.id)}
                        className="glass-btn-primary px-3 py-1.5 text-xs font-semibold"
                      >
                        Conciliar sugerido
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await ignoreBankTransaction(row.id);
                          setMessage(result.error ?? 'Movimiento ignorado.');
                          if (result.success) onReload();
                        });
                      }}
                      className="glass-btn px-3 py-1.5 text-xs"
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
