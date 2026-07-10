'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { detectBankImportFormat, formatCurrency } from '@veka/shared';

import {
  importBankTransactions,
  ignoreBankTransaction,
  matchBankTransaction,
  saveBankAccount,
  unmatchBankTransaction,
} from '@/app/(panel)/finanzas/bank-actions';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HELP } from '@/lib/help-content';

interface BankAccountRow {
  id: string;
  name: string;
  bank_name: string | null;
  account_last4: string | null;
  clabe: string | null;
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

function formatImportLabel(format?: string) {
  if (format === 'ofx') return 'OFX';
  if (format === 'csv') return 'CSV';
  return 'archivo';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [clabe, setClabe] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(bankAccounts[0]?.id ?? '');
  const [importContent, setImportContent] = useState('');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<'csv' | 'ofx' | null>(null);
  const [manualPickByTx, setManualPickByTx] = useState<Record<string, string>>({});
  const [manualFilterByTx, setManualFilterByTx] = useState<Record<string, string>>({});
  const [showAllByTx, setShowAllByTx] = useState<Record<string, boolean>>({});

  const unmatched = useMemo(
    () => bankTransactions.filter((row) => row.status === 'unmatched'),
    [bankTransactions],
  );

  const resolved = useMemo(
    () => bankTransactions.filter((row) => row.status === 'matched' || row.status === 'ignored'),
    [bankTransactions],
  );

  const matchOptions = useMemo(() => {
    const options: { key: string; type: 'payment' | 'income' | 'expense'; id: string; label: string; amount: number }[] =
      [];
    for (const payment of payments) {
      options.push({
        key: `payment:${payment.id}`,
        type: 'payment',
        id: payment.id,
        label: `Pago · ${payment.charge?.concept ?? 'Cuota'} · ${formatCurrency(Number(payment.amount))}`,
        amount: Number(payment.amount),
      });
    }
    for (const income of incomeEntries) {
      options.push({
        key: `income:${income.id}`,
        type: 'income',
        id: income.id,
        label: `Ingreso · ${income.concept} · ${formatCurrency(Number(income.amount))}`,
        amount: Number(income.amount),
      });
    }
    for (const expense of expenses) {
      options.push({
        key: `expense:${expense.id}`,
        type: 'expense',
        id: expense.id,
        label: `Egreso · ${expense.concept} · ${formatCurrency(Number(expense.amount))}`,
        amount: Number(expense.amount),
      });
    }
    return options;
  }, [expenses, incomeEntries, payments]);

  function saveAccount() {
    setMessage(null);
    const formData = new FormData();
    formData.set('condominium_id', condominiumId);
    formData.set('name', accountName);
    formData.set('bank_name', bankName);
    formData.set('account_last4', accountLast4);
    formData.set('clabe', clabe);
    startTransition(async () => {
      const result = await saveBankAccount(formData);
      setMessage(result.error ?? 'Cuenta bancaria registrada.');
      if (result.success) {
        setAccountName('');
        setBankName('');
        setAccountLast4('');
        setClabe('');
        onReload();
      }
    });
  }

  function handleImportContentChange(value: string, fileName?: string | null) {
    setImportContent(value);
    setImportFileName(fileName ?? null);
    setDetectedFormat(value.trim() ? detectBankImportFormat(value) : null);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      handleImportContentChange(text, file.name);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function importFeed() {
    setMessage(null);
    const formData = new FormData();
    formData.set('bank_account_id', selectedAccountId);
    formData.set('import_content', importContent);
    if (detectedFormat) formData.set('format', detectedFormat);
    startTransition(async () => {
      const result = await importBankTransactions(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const formatLabel = formatImportLabel('format' in result ? result.format : detectedFormat ?? undefined);
      const warning = 'warning' in result && result.warning ? ` ${result.warning}` : '';
      setMessage(
        `Importados ${'imported' in result ? result.imported : 0} movimientos (${formatLabel}).${warning}`,
      );
      if (result.success) {
        setImportContent('');
        setImportFileName(null);
        setDetectedFormat(null);
        onReload();
      }
    });
  }

  function suggestMatch(amount: number) {
    const normalizedAmount = Math.abs(Number(amount));
    const tolerance = 0.01;
    const payment = payments.find((row) => Math.abs(Number(row.amount) - normalizedAmount) <= tolerance);
    if (payment) return { type: 'payment' as const, id: payment.id, label: payment.charge?.concept ?? 'Pago' };
    const income = incomeEntries.find((row) => Math.abs(Number(row.amount) - normalizedAmount) <= tolerance);
    if (income) return { type: 'income' as const, id: income.id, label: income.concept };
    const expense = expenses.find((row) => Math.abs(Number(row.amount) - normalizedAmount) <= tolerance);
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
      if ('error' in result && result.error) {
        setMessage(result.error);
        return;
      }
      setMessage('Movimiento conciliado.');
      onReload();
    });
  }

  return (
    <div className="space-y-6">
      <GlassCard>
        <SectionHeading help={HELP.banco.cuentas}>Conciliación bancaria</SectionHeading>
        <p className="mt-1 text-sm text-muted">
          Importa movimientos del banco (OFX o CSV) y concílialos con pagos, ingresos o egresos del libro.
        </p>

        <p className="mt-2 text-xs text-subtle">
          La CLABE (18 dígitos) es la que ven los residentes para transferir. Sin ella, la app no puede
          mostrar datos de pago útiles.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
            value={clabe}
            onChange={(event) => setClabe(event.target.value.replace(/[^\d]/g, '').slice(0, 18))}
            placeholder="CLABE (18 dígitos)"
            inputMode="numeric"
            className="glass-input"
          />
          <input
            value={accountLast4}
            onChange={(event) => setAccountLast4(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
            placeholder="Últimos 4 dígitos (opcional)"
            inputMode="numeric"
            className="glass-input"
          />
        </div>
        {bankAccounts.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-subtle">
            {bankAccounts.map((account) => (
              <li key={account.id}>
                {account.name}
                {account.bank_name ? ` · ${account.bank_name}` : ''}
                {account.clabe ? ` · CLABE ${account.clabe}` : ' · sin CLABE'}
                {account.account_last4 ? ` ···${account.account_last4}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
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
        <SectionHeading as="h3" className="text-base font-semibold text-[var(--text)]" help={HELP.banco.import}>
          Importar feed bancario
        </SectionHeading>
        <p className="mt-1 text-xs text-subtle">
          Sube un archivo <strong className="font-semibold text-muted">.ofx</strong> /{' '}
          <strong className="font-semibold text-muted">.qfx</strong> del banco o pega un{' '}
          <strong className="font-semibold text-muted">CSV</strong> con columnas: fecha, monto,
          descripción, referencia.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.qfx,.csv,text/plain,text/csv,application/xml,text/xml"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className="glass-btn px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Seleccionar archivo
          </button>
          {importFileName ? (
            <span className="text-xs text-subtle">
              {importFileName}
              {detectedFormat ? ` · detectado ${detectedFormat.toUpperCase()}` : ''}
            </span>
          ) : null}
        </div>
        <textarea
          value={importContent}
          onChange={(event) => handleImportContentChange(event.target.value)}
          rows={5}
          className="glass-input mt-3 w-full resize-y font-mono text-xs"
          placeholder={'OFX del banco o CSV:\nfecha,monto,descripcion,referencia\n2026-06-01,3500.00,SPEI UNIDAD 101,REF123'}
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={importFeed}
            disabled={pending || !selectedAccountId || !importContent.trim()}
            className="glass-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Importar movimientos
          </button>
        </div>
      </GlassCard>

      {message ? (
        <p
          className={`text-sm ${message.includes('error') || message.includes('obligat') || message.includes('No se') ? 'text-red-300' : 'text-emerald-300'}`}
        >
          {message}
        </p>
      ) : null}

      <GlassCard>
        <SectionHeading
          as="h3"
          className="text-base font-semibold text-[var(--text)]"
          help={HELP.banco.conciliar}
        >
          Pendientes de conciliar ({unmatched.length})
        </SectionHeading>
        {unmatched.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">No hay movimientos bancarios sin conciliar.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {unmatched.map((row) => {
              const suggestion = suggestMatch(Number(row.amount));
              const amount = Number(row.amount);
              const absAmount = Math.abs(amount);
              const filter = (manualFilterByTx[row.id] ?? '').trim().toLowerCase();
              const showAll = showAllByTx[row.id] ?? false;
              const nearbyOptions = matchOptions.filter(
                (option) => Math.abs(option.amount - absAmount) <= Math.max(1, absAmount * 0.05),
              );
              const baseOptions = showAll || nearbyOptions.length === 0 ? matchOptions : nearbyOptions;
              const optionsForSelect = (
                filter
                  ? baseOptions.filter((option) => option.label.toLowerCase().includes(filter))
                  : baseOptions
              ).slice(0, 80);
              const selectedKey = manualPickByTx[row.id] ?? '';
              const selected =
                optionsForSelect.find((option) => option.key === selectedKey) ??
                matchOptions.find((option) => option.key === selectedKey) ??
                null;
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--text)]">
                        {row.transaction_date} · {formatCurrency(amount)}
                        {amount < 0 ? (
                          <span className="ml-2 text-xs text-amber-200">egreso</span>
                        ) : (
                          <span className="ml-2 text-xs text-emerald-200">ingreso</span>
                        )}
                      </p>
                      <p className="text-sm text-muted">
                        {row.description || row.reference || 'Sin descripción'}
                      </p>
                      {suggestion ? (
                        <p className="mt-1 text-xs text-emerald-300">
                          Sugerencia: {suggestion.label} ({suggestion.type})
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-subtle">Sin sugerencia automática · elige un match manual.</p>
                      )}
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <input
                      value={manualFilterByTx[row.id] ?? ''}
                      onChange={(event) =>
                        setManualFilterByTx((prev) => ({ ...prev, [row.id]: event.target.value }))
                      }
                      className="glass-input min-w-[12rem] flex-1 text-xs"
                      placeholder="Filtrar por concepto o monto…"
                    />
                    <select
                      value={selectedKey}
                      onChange={(event) =>
                        setManualPickByTx((prev) => ({ ...prev, [row.id]: event.target.value }))
                      }
                      className="glass-input min-w-[16rem] flex-1 text-xs"
                    >
                      <option value="">Elegir pago / ingreso / egreso…</option>
                      {optionsForSelect.map((option) => (
                        <option key={option.key} value={option.key} className="bg-slate-900">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllByTx((prev) => ({ ...prev, [row.id]: !showAll }))
                      }
                      className="glass-btn px-3 py-1.5 text-xs font-semibold"
                    >
                      {showAll ? 'Solo cercanos' : 'Ver todos'}
                    </button>
                    <button
                      type="button"
                      disabled={pending || !selected}
                      onClick={() => {
                        if (!selected) return;
                        matchRow(row.id, selected.type, selected.id);
                      }}
                      className="glass-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      Conciliar manual
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {resolved.length > 0 ? (
        <GlassCard>
          <SectionHeading as="h3" className="text-base font-semibold text-[var(--text)]">
            Conciliados o ignorados ({resolved.length})
          </SectionHeading>
          <p className="mt-1 text-xs text-subtle">
            Puedes deshacer un match o volver a poner en cola un movimiento ignorado.
          </p>
          <div className="mt-4 space-y-2">
            {resolved.slice(0, 40).map((row) => {
              const amount = Number(row.amount);
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      {row.transaction_date} · {formatCurrency(amount)} ·{' '}
                      {row.status === 'matched' ? 'Conciliado' : 'Ignorado'}
                    </p>
                    <p className="text-xs text-subtle">
                      {row.description || row.reference || 'Sin descripción'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !confirm(
                          row.status === 'matched'
                            ? '¿Deshacer esta conciliación?'
                            : '¿Volver a poner este movimiento como pendiente?',
                        )
                      ) {
                        return;
                      }
                      startTransition(async () => {
                        const result = await unmatchBankTransaction(row.id);
                        setMessage(
                          result.error ??
                            (row.status === 'matched'
                              ? 'Conciliación deshecha.'
                              : 'Movimiento vuelto a pendientes.'),
                        );
                        if (result.success) onReload();
                      });
                    }}
                    className="glass-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    Deshacer
                  </button>
                </div>
              );
            })}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
