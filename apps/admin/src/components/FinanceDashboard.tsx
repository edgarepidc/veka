'use client';

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from 'react';
import type { ChargeStatus, ExpenseKind, ExpenseStatus, FundType, PaymentStatus } from '@veka/shared';
import {
  EXPENSE_CATEGORIES,
  STORAGE_BUCKETS,
  chargeStatusLabel,
  expenseCategoryLabel,
  expenseEvidencePath,
  expenseKindLabel,
  expenseStatusLabel,
  formatCurrency,
  fundTypeLabel,
} from '@veka/shared';

import { createExpense } from '@/app/(panel)/finanzas/actions';
import { FileUpload } from '@/components/ui/FileUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import { DEMO_CONDO_ID } from '@/lib/constants';

type FinanceTab = 'estado' | 'movimientos' | 'proveedores' | 'nomina' | 'morosidad';

interface UnitOption {
  id: string;
  identifier: string;
  cluster_id: string | null;
}

interface ClusterRow {
  id: string;
  name: string;
}

interface FundBalanceRow {
  fund_type: FundType;
  balance: number;
  as_of_date: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  status: PaymentStatus;
  proof_url: string | null;
  created_at: string;
  paid_at: string | null;
  unit: { identifier: string } | null;
  charge: { concept: string } | null;
}

interface ChargeRow {
  id: string;
  concept: string;
  amount: number;
  due_date: string;
  status: ChargeStatus;
  unit: { identifier: string; cluster_id: string | null } | null;
}

interface ExpenseRow {
  id: string;
  concept: string;
  amount: number;
  category: string;
  expense_date: string;
  vendor_name: string | null;
  expense_kind: ExpenseKind;
  status: ExpenseStatus;
  fund_type: FundType;
  attachments: { id: string; file_url: string; file_name: string | null }[];
}

const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'estado', label: 'Estado financiero' },
  { id: 'movimientos', label: 'Ingresos y egresos' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'nomina', label: 'Empleados' },
  { id: 'morosidad', label: 'Morosidad' },
];

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});
}

function sumAmount(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + Number(item.amount), 0);
}

export function FinanceDashboard() {
  const supabase = createClient();
  const expenseFileId = useId().replace(/:/g, '');
  const [tab, setTab] = useState<FinanceTab>('estado');
  const [loading, setLoading] = useState(true);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [expenseMessage, setExpenseMessage] = useState<string | null>(null);
  const [expensePending, startExpense] = useTransition();

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [funds, setFunds] = useState<FundBalanceRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [newCharge, setNewCharge] = useState({
    unitId: '',
    concept: 'Cuota de mantenimiento',
    amount: '3500',
    dueDate: '',
  });

  const load = useCallback(async () => {
    setLoading(true);

    const [unitsRes, clustersRes, fundsRes, chargesRes, paymentsRes, expensesRes] = await Promise.all([
      supabase
        .from('units')
        .select('id, identifier, cluster_id')
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('identifier'),
      supabase
        .from('clusters')
        .select('id, name')
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('name'),
      supabase
        .from('fund_balances')
        .select('fund_type, balance, as_of_date')
        .eq('condominium_id', DEMO_CONDO_ID),
      supabase
        .from('charges')
        .select('id, concept, amount, due_date, status, unit:units(identifier, cluster_id)')
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('due_date', { ascending: false }),
      supabase
        .from('payments')
        .select(
          'id, amount, status, proof_url, created_at, paid_at, unit:units(identifier), charge:charges(concept)',
        )
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select(
          'id, concept, amount, category, expense_date, vendor_name, expense_kind, status, fund_type, attachments:expense_attachments(id, file_url, file_name)',
        )
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('expense_date', { ascending: false }),
    ]);

    setUnits((unitsRes.data as UnitOption[]) ?? []);
    setClusters((clustersRes.data as ClusterRow[]) ?? []);
    setFunds((fundsRes.data as FundBalanceRow[]) ?? []);
    setCharges((chargesRes.data as unknown as ChargeRow[]) ?? []);
    setPayments((paymentsRes.data as unknown as PaymentRow[]) ?? []);
    setExpenses((expensesRes.data as unknown as ExpenseRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const approvedPayments = useMemo(
    () => payments.filter((p) => p.status === 'approved'),
    [payments],
  );

  const paidExpenses = useMemo(
    () => expenses.filter((e) => e.status === 'paid'),
    [expenses],
  );

  const delinquentCharges = useMemo(
    () => charges.filter((c) => c.status === 'overdue' || c.status === 'pending'),
    [charges],
  );

  const supplierExpenses = useMemo(
    () => expenses.filter((e) => e.expense_kind === 'supplier'),
    [expenses],
  );

  const payrollExpenses = useMemo(
    () => expenses.filter((e) => e.expense_kind === 'payroll'),
    [expenses],
  );

  const morosityByCluster = useMemo(() => {
    const clusterMap = new Map(clusters.map((c) => [c.id, c.name]));
    const grouped: Record<string, { clusterName: string; items: ChargeRow[]; total: number }> = {};

    for (const charge of delinquentCharges.filter((c) => c.status === 'overdue')) {
      const clusterId = charge.unit?.cluster_id ?? 'sin-cluster';
      const clusterName = clusterId === 'sin-cluster' ? 'Sin torre' : (clusterMap.get(clusterId) ?? 'Sin torre');
      grouped[clusterId] ??= { clusterName, items: [], total: 0 };
      grouped[clusterId].items.push(charge);
      grouped[clusterId].total += Number(charge.amount);
    }

    return Object.entries(grouped).sort((a, b) => a[1].clusterName.localeCompare(b[1].clusterName));
  }, [clusters, delinquentCharges]);

  const incomeByCategory = useMemo(() => {
    const grouped = groupBy(approvedPayments, (p) => {
      const concept = p.charge?.concept ?? 'Otros ingresos';
      if (concept.toLowerCase().includes('mantenimiento')) return 'Cuotas de mantenimiento';
      if (concept.toLowerCase().includes('extraordinari')) return 'Cuotas extraordinarias';
      return 'Otros ingresos';
    });
    return Object.entries(grouped).map(([label, items]) => ({ label, items, total: sumAmount(items) }));
  }, [approvedPayments]);

  const expensesByCategory = useMemo(() => {
    const grouped = groupBy(paidExpenses, (e) => e.category);
    return Object.entries(grouped).map(([category, items]) => ({
      category,
      items,
      total: sumAmount(items),
    }));
  }, [paidExpenses]);

  const suppliersByVendor = useMemo(() => {
    const grouped = groupBy(
      supplierExpenses.filter((e) => e.vendor_name),
      (e) => e.vendor_name!,
    );
    return Object.entries(grouped).map(([vendor, items]) => ({
      vendor,
      paid: sumAmount(items.filter((i) => i.status === 'paid')),
      pending: sumAmount(items.filter((i) => i.status === 'pending')),
      items,
    }));
  }, [supplierExpenses]);

  const totalIncome = sumAmount(approvedPayments);
  const totalVerifiedExpenses = sumAmount(paidExpenses);
  const totalReceivable = sumAmount(delinquentCharges.filter((c) => c.status === 'overdue'));
  const totalPayables = sumAmount(supplierExpenses.filter((e) => e.status === 'pending'));

  async function createCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!newCharge.unitId || !newCharge.dueDate) return;

    const { error } = await supabase.from('charges').insert({
      condominium_id: DEMO_CONDO_ID,
      unit_id: newCharge.unitId,
      concept: newCharge.concept,
      amount: Number(newCharge.amount),
      due_date: newCharge.dueDate,
      status: 'pending',
      fund_type: 'operating',
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewCharge((prev) => ({ ...prev, concept: 'Cuota de mantenimiento', amount: '3500' }));
    void load();
  }

  async function reviewPayment(id: string, action: 'approve' | 'reject') {
    const res = await fetch(`/api/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'Error al procesar pago');
      return;
    }

    void load();
  }

  function runCreateExpense(formData: FormData) {
    setExpenseMessage(null);
    startExpense(async () => {
      const result = await createExpense(formData);
      if (result.error) {
        setExpenseMessage(result.error);
        return;
      }
      setExpenseMessage('Egreso registrado.');
      void load();
    });
  }

  async function openExpenseEvidence(path: string) {
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.EXPENSE_EVIDENCE).createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  if (loading) {
    return <p className="p-8 text-muted">Cargando finanzas…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="glass-tab-strip">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`glass-tab ${tab === item.id ? 'glass-tab-active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'estado' ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Ingresos comprobados" value={formatCurrency(totalIncome)} tone="green" />
            <SummaryCard label="Egresos comprobados" value={formatCurrency(totalVerifiedExpenses)} tone="neutral" />
            <SummaryCard label="Por cobrar (morosos)" value={formatCurrency(totalReceivable)} tone="amber" />
            <SummaryCard label="Adeudos a proveedores" value={formatCurrency(totalPayables)} tone="red" />
          </div>

          <GlassCard>
            <h2 className="text-lg font-semibold text-[var(--text)]">Saldos por fondo</h2>
            <p className="mt-1 text-sm text-muted">Posición al cierre más reciente registrada.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {funds.length === 0 ? (
                <p className="text-sm text-subtle">Sin saldos registrados.</p>
              ) : (
                funds.map((fund) => (
                  <div key={fund.fund_type} className="glass-card-deep p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                      {fundTypeLabel(fund.fund_type)}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-accent">{formatCurrency(Number(fund.balance))}</p>
                    <p className="mt-1 text-xs text-subtle">Al {fund.as_of_date}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
              <p>
                <span className="font-semibold text-[var(--text)]">Resultado del periodo:</span>{' '}
                {formatCurrency(totalIncome - totalVerifiedExpenses)}{' '}
                <span className="text-subtle">(ingresos − egresos comprobados)</span>
              </p>
            </div>
          </GlassCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <GlassCard>
              <h2 className="text-lg font-semibold text-[var(--text)]">Nueva cuota</h2>
              <form onSubmit={createCharge} className="mt-4 space-y-3">
                <select
                  required
                  value={newCharge.unitId}
                  onChange={(e) => setNewCharge((p) => ({ ...p, unitId: e.target.value }))}
                  className="glass-input"
                >
                  <option value="">Selecciona unidad</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.identifier}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={newCharge.concept}
                  onChange={(e) => setNewCharge((p) => ({ ...p, concept: e.target.value }))}
                  className="glass-input"
                  placeholder="Concepto"
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={newCharge.amount}
                  onChange={(e) => setNewCharge((p) => ({ ...p, amount: e.target.value }))}
                  className="glass-input"
                  placeholder="Monto"
                />
                <input
                  required
                  type="date"
                  value={newCharge.dueDate}
                  onChange={(e) => setNewCharge((p) => ({ ...p, dueDate: e.target.value }))}
                  className="glass-input"
                />
                <button type="submit" className="glass-btn-primary">
                  Crear cuota
                </button>
              </form>
            </GlassCard>

            <GlassCard>
              <h2 className="text-lg font-semibold text-[var(--text)]">Pagos por revisar</h2>
              <div className="mt-4 space-y-3">
                {payments.filter((p) => p.status === 'pending_review').length === 0 ? (
                  <p className="text-sm text-subtle">No hay comprobantes pendientes.</p>
                ) : (
                  payments
                    .filter((p) => p.status === 'pending_review')
                    .map((payment) => (
                      <div key={payment.id} className="glass-card-deep p-4">
                        <p className="font-medium text-[var(--text)]">
                          {payment.unit?.identifier} · {formatCurrency(Number(payment.amount))}
                        </p>
                        <p className="text-sm text-muted">{payment.charge?.concept}</p>
                        {payment.proof_url ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const { data } = await supabase.storage
                                .from('payment-proofs')
                                .createSignedUrl(payment.proof_url!, 3600);
                              if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                            }}
                            className="mt-2 inline-block text-sm text-accent-2 hover:underline"
                          >
                            Ver comprobante
                          </button>
                        ) : null}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => reviewPayment(payment.id, 'approve')}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewPayment(payment.id, 'reject')}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}

      {tab === 'movimientos' ? (
        <div className="space-y-6">
          <GlassCard>
            <h2 className="text-lg font-semibold text-[var(--text)]">Registrar egreso</h2>
            <p className="mt-1 text-sm text-muted">
              Clasifica el gasto y adjunta el comprobante cuando esté pagado.
            </p>
            {expenseMessage ? (
              <p
                className={`mt-3 text-sm ${expenseMessage.includes('registrado') ? 'text-accent' : 'text-red-300'}`}
              >
                {expenseMessage}
              </p>
            ) : null}
            <form action={runCreateExpense} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="concept" required placeholder="Concepto del gasto" className="glass-input sm:col-span-2" />
              <input
                name="amount"
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto"
                className="glass-input"
              />
              <input
                name="expense_date"
                required
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="glass-input"
              />
              <select name="category" required className="glass-input">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900">
                    {expenseCategoryLabel(cat)}
                  </option>
                ))}
              </select>
              <select name="fund_type" defaultValue="operating" className="glass-input">
                <option value="operating" className="bg-slate-900">
                  {fundTypeLabel('operating')}
                </option>
                <option value="reserve" className="bg-slate-900">
                  {fundTypeLabel('reserve')}
                </option>
              </select>
              <select name="expense_kind" defaultValue="general" className="glass-input">
                <option value="general" className="bg-slate-900">
                  {expenseKindLabel('general')}
                </option>
                <option value="supplier" className="bg-slate-900">
                  {expenseKindLabel('supplier')}
                </option>
                <option value="payroll" className="bg-slate-900">
                  {expenseKindLabel('payroll')}
                </option>
              </select>
              <select name="status" defaultValue="paid" className="glass-input">
                <option value="paid" className="bg-slate-900">
                  {expenseStatusLabel('paid')}
                </option>
                <option value="pending" className="bg-slate-900">
                  {expenseStatusLabel('pending')}
                </option>
              </select>
              <input
                name="vendor_name"
                placeholder="Proveedor o empleado (si aplica)"
                className="glass-input sm:col-span-2"
              />
              <textarea
                name="notes"
                rows={2}
                placeholder="Notas (opcional)"
                className="glass-input min-h-[72px] sm:col-span-2"
              />
              <div className="sm:col-span-2">
                <FileUpload
                  bucket={STORAGE_BUCKETS.EXPENSE_EVIDENCE}
                  inputName="evidence_path"
                  label="Comprobante de pago"
                  hint="Imagen o PDF del gasto comprobado."
                  buildPath={(ext) => expenseEvidencePath(DEMO_CONDO_ID, expenseFileId, ext)}
                />
              </div>
              <button type="submit" disabled={expensePending} className="glass-btn-primary sm:col-span-2">
                {expensePending ? 'Guardando…' : 'Registrar egreso'}
              </button>
            </form>
          </GlassCard>

          <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <h2 className="text-lg font-semibold text-[var(--text)]">Ingresos</h2>
            <p className="mt-1 text-sm text-muted">Cuotas y pagos aprobados con comprobante.</p>
            <div className="mt-4 space-y-4">
              {incomeByCategory.length === 0 ? (
                <p className="text-sm text-subtle">Sin ingresos registrados.</p>
              ) : (
                incomeByCategory.map((group) => (
                  <div key={group.label}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--text)]">{group.label}</p>
                      <span className="text-sm font-bold text-accent">{formatCurrency(group.total)}</span>
                    </div>
                    <ul className="space-y-2">
                      {group.items.map((payment) => (
                        <li key={payment.id} className="glass-card-deep flex justify-between gap-3 px-3 py-2 text-sm">
                          <span className="text-[var(--text)]">
                            {payment.unit?.identifier} · {payment.charge?.concept}
                          </span>
                          <span className="shrink-0 text-muted">{formatCurrency(Number(payment.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="text-lg font-semibold text-[var(--text)]">Egresos comprobados</h2>
            <p className="mt-1 text-sm text-muted">Gastos pagados, clasificados por categoría.</p>
            <div className="mt-4 space-y-4">
              {expensesByCategory.length === 0 ? (
                <p className="text-sm text-subtle">Sin egresos registrados.</p>
              ) : (
                expensesByCategory.map((group) => (
                  <div key={group.category}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {expenseCategoryLabel(group.category)}
                      </p>
                      <span className="text-sm font-bold">{formatCurrency(group.total)}</span>
                    </div>
                    <ul className="space-y-2">
                      {group.items.map((expense) => (
                        <li key={expense.id} className="glass-card-deep px-3 py-2 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-[var(--text)]">{expense.concept}</p>
                              <p className="text-xs text-subtle">
                                {expense.expense_date}
                                {expense.vendor_name ? ` · ${expense.vendor_name}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(Number(expense.amount))}</p>
                              {expense.attachments.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => void openExpenseEvidence(expense.attachments[0]!.file_url)}
                                  className="glass-tag-green mt-1 hover:opacity-80"
                                >
                                  Ver comprobante
                                </button>
                              ) : (
                                <span className="mt-1 inline-block text-xs text-subtle">Sin comprobante</span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
          </div>
        </div>
      ) : null}

      {tab === 'proveedores' ? (
        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Pagos y adeudos a proveedores</h2>
          <p className="mt-1 text-sm text-muted">
            Estado de cuenta por proveedor: pagos realizados y saldos pendientes.
          </p>
          <div className="mt-4 space-y-4">
            {suppliersByVendor.length === 0 ? (
              <p className="text-sm text-subtle">Sin movimientos de proveedores.</p>
            ) : (
              suppliersByVendor.map((vendor) => (
                <div key={vendor.vendor} className="glass-card-deep p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text)]">{vendor.vendor}</p>
                      <p className="mt-1 text-xs text-subtle">
                        Pagado: {formatCurrency(vendor.paid)}
                        {vendor.pending > 0 ? ` · Adeudo: ${formatCurrency(vendor.pending)}` : ''}
                      </p>
                    </div>
                    {vendor.pending > 0 ? (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-0.5 text-xs font-bold text-amber-100">
                        Adeudo pendiente
                      </span>
                    ) : (
                      <span className="glass-tag-green">Al corriente</span>
                    )}
                  </div>
                  <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    {vendor.items.map((expense) => (
                      <li key={expense.id} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text)]">
                          {expense.concept} · {expense.expense_date}
                        </span>
                        <span className="flex items-center gap-2">
                          <span>{formatCurrency(Number(expense.amount))}</span>
                          <StatusBadge status={expense.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      ) : null}

      {tab === 'nomina' ? (
        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Pago a empleados</h2>
          <p className="mt-1 text-sm text-muted">Nómina y compensaciones al personal del condominio.</p>
          <div className="mt-4 space-y-3">
            {payrollExpenses.length === 0 ? (
              <p className="text-sm text-subtle">Sin registros de nómina.</p>
            ) : (
              payrollExpenses.map((expense) => (
                <div key={expense.id} className="glass-card-deep flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-[var(--text)]">{expense.concept}</p>
                    <p className="text-sm text-subtle">
                      {expense.vendor_name ?? 'Empleado'} · {expense.expense_date} ·{' '}
                      {expenseCategoryLabel(expense.category)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCurrency(Number(expense.amount))}</span>
                    <StatusBadge status={expense.status} />
                    {expense.attachments.length > 0 ? <span className="glass-tag-green">Comprobado</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      ) : null}

      {tab === 'morosidad' ? (
        <div className="space-y-4">
          <GlassCard className="!p-4">
            <p className="text-sm text-muted">
              Unidades con cuotas vencidas, agrupadas por torre o cluster. Los recordatorios de cobro se
              envían por notificación push según las reglas del condominio.
            </p>
            <p className="mt-2 text-lg font-bold text-amber-200">
              Total morosidad: {formatCurrency(totalReceivable)}
            </p>
          </GlassCard>

          {morosityByCluster.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-subtle">No hay unidades morosas registradas.</p>
            </GlassCard>
          ) : (
            morosityByCluster.map(([clusterId, group]) => {
              const open = expandedClusters[clusterId] ?? true;
              return (
                <GlassCard key={clusterId} className="overflow-hidden !p-0">
                  <button
                    type="button"
                    onClick={() => setExpandedClusters((prev) => ({ ...prev, [clusterId]: !open }))}
                    className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/5"
                  >
                    <Chevron open={open} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--text)]">{group.clusterName}</p>
                      <p className="mt-1 text-xs text-subtle">
                        {group.items.length} unidad{group.items.length === 1 ? '' : 'es'} morosa
                        {group.items.length === 1 ? '' : 's'} · {formatCurrency(group.total)}
                      </p>
                    </div>
                  </button>
                  {open ? (
                    <ul className="space-y-2 border-t border-white/10 px-4 pb-4 pt-3">
                      {group.items.map((charge) => (
                        <li
                          key={charge.id}
                          className="glass-card-deep flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium text-[var(--text)]">{charge.unit?.identifier}</p>
                            <p className="text-xs text-subtle">
                              {charge.concept} · vence {charge.due_date}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-amber-200">
                              {formatCurrency(Number(charge.amount))}
                            </span>
                            <span className="rounded-full border border-red-400/30 bg-red-400/15 px-2 py-0.5 text-xs font-bold text-red-100">
                              {chargeStatusLabel(charge.status)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </GlassCard>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'neutral' | 'amber' | 'red';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-accent'
      : tone === 'amber'
        ? 'text-amber-200'
        : tone === 'red'
          ? 'text-red-200'
          : 'text-[var(--text)]';

  return (
    <div className="glass-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  if (status === 'paid') {
    return <span className="glass-tag-green text-xs">{expenseStatusLabel(status)}</span>;
  }
  return (
    <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-100">
      {expenseStatusLabel(status)}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={`mt-0.5 shrink-0 text-subtle transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      ▸
    </span>
  );
}
