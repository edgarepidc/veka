'use client';

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from 'react';
import type {
  ChargeStatus,
  ExpenseKind,
  ExpenseStatus,
  FeeCampaignStatus,
  FeeScope,
  FundType,
  PaymentStatus,
} from '@veka/shared';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  STORAGE_BUCKETS,
  chargeStatusLabel,
  expenseCategoryLabel,
  expenseEvidencePath,
  expenseKindLabel,
  expenseStatusLabel,
  formatCurrency,
  fundTypeLabel,
  incomeCategoryLabel,
  matchesFinanceClusterFilter,
} from '@veka/shared';
import type { RecurringFeeStatus } from '@veka/shared';

import { createExpense, createIncome, ensureMonthlyRecurringCharges } from '@/app/(panel)/finanzas/actions';
import { CuotasPanel } from '@/components/CuotasPanel';
import { FinanceEstadoPanel } from '@/components/FinanceEstadoPanel';
import { FinanceClusterField, FinanceScopeFilter } from '@/components/FinanceScopeFilter';
import { ResidentPaymentsReview } from '@/components/ResidentPaymentsReview';
import { UnitStatementPanel } from '@/components/UnitStatementPanel';
import { FileUpload } from '@/components/ui/FileUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import { DEMO_CONDO_ID } from '@/lib/constants';

type FinanceTab = 'estado' | 'cuotas' | 'movimientos' | 'cuentas' | 'proveedores' | 'nomina' | 'morosidad';

interface UnitOption {
  id: string;
  identifier: string;
  cluster_id: string | null;
}

interface ClusterRow {
  id: string;
  name: string;
}

interface CondominiumRow {
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
  charge_id: string;
  unit_id: string;
  amount: number;
  status: PaymentStatus;
  proof_url: string | null;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
  unit: {
    identifier: string;
    cluster_id: string | null;
    cluster: { name: string } | null;
  } | null;
  charge: { concept: string; due_date: string } | null;
}

interface ChargeRow {
  id: string;
  unit_id: string;
  concept: string;
  amount: number;
  due_date: string;
  status: ChargeStatus;
  fee_campaign_id: string | null;
  recurring_fee_id: string | null;
  unit: { identifier: string; cluster_id: string | null } | null;
}

interface RecurringFeeRow {
  id: string;
  scope: 'general' | 'cluster';
  concept: string;
  due_day: number;
  fund_type: FundType;
  status: RecurringFeeStatus;
  cluster: { name: string } | null;
  revisions: { base_amount: number; effective_from: string }[];
}

interface FeeCampaignRow {
  id: string;
  scope: FeeScope;
  concept: string;
  amount: number;
  due_date: string;
  fund_type: FundType;
  period_month: string | null;
  status: FeeCampaignStatus;
  created_at: string;
  cluster: { name: string } | null;
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
  cluster_id: string | null;
  attachments: { id: string; file_url: string; file_name: string | null }[];
}

interface IncomeEntryRow {
  id: string;
  concept: string;
  amount: number;
  category: string;
  income_date: string;
  fund_type: FundType;
  cluster_id: string | null;
  notes: string | null;
}

const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'estado', label: 'Estado financiero' },
  { id: 'cuotas', label: 'Cuotas' },
  { id: 'movimientos', label: 'Ingresos y egresos' },
  { id: 'cuentas', label: 'Estado de cuenta' },
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

function normalizePaymentRow(row: PaymentRow): PaymentRow {
  if (!row.unit) return row;
  const cluster = row.unit.cluster as { name: string } | { name: string }[] | null | undefined;
  const normalizedCluster = Array.isArray(cluster) ? (cluster[0] ?? null) : (cluster ?? null);
  return { ...row, unit: { ...row.unit, cluster: normalizedCluster } };
}

export function FinanceDashboard() {
  const supabase = createClient();
  const expenseFileId = useId().replace(/:/g, '');
  const [tab, setTab] = useState<FinanceTab>('estado');
  const [loading, setLoading] = useState(true);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [expenseMessage, setExpenseMessage] = useState<string | null>(null);
  const [incomeMessage, setIncomeMessage] = useState<string | null>(null);
  const [expensePending, startExpense] = useTransition();
  const [incomePending, startIncome] = useTransition();

  const [condominiums, setCondominiums] = useState<CondominiumRow[]>([]);
  const [selectedCondoId, setSelectedCondoId] = useState(DEMO_CONDO_ID);
  const [selectedClusterId, setSelectedClusterId] = useState('');

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [funds, setFunds] = useState<FundBalanceRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [feeCampaigns, setFeeCampaigns] = useState<FeeCampaignRow[]>([]);
  const [recurringFees, setRecurringFees] = useState<RecurringFeeRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntryRow[]>([]);

  const loadCondominiums = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('memberships')
      .select('condominium_id, condominium:condominiums(id, name)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    const rows =
      (data as { condominium_id: string; condominium: { id: string; name: string } | null }[] | null) ?? [];
    const options = rows
      .map((row) => ({
        id: row.condominium?.id ?? row.condominium_id,
        name: row.condominium?.name ?? 'Condominio',
      }))
      .filter((row, index, list) => list.findIndex((item) => item.id === row.id) === index);

    if (options.length > 0) {
      setCondominiums(options);
      setSelectedCondoId((current) =>
        options.some((option) => option.id === current) ? current : options[0]!.id,
      );
    }
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);

    const condoId = selectedCondoId || DEMO_CONDO_ID;

    const [unitsRes, clustersRes, fundsRes, chargesRes, campaignsRes, recurringRes, paymentsRes, expensesRes, incomesRes] =
      await Promise.all([
      supabase
        .from('units')
        .select('id, identifier, cluster_id')
        .eq('condominium_id', condoId)
        .order('identifier'),
      supabase
        .from('clusters')
        .select('id, name')
        .eq('condominium_id', condoId)
        .order('name'),
      supabase
        .from('fund_balances')
        .select('fund_type, balance, as_of_date')
        .eq('condominium_id', condoId),
      supabase
        .from('charges')
        .select(
          'id, unit_id, concept, amount, due_date, status, fee_campaign_id, recurring_fee_id, unit:units(identifier, cluster_id)',
        )
        .eq('condominium_id', condoId)
        .order('due_date', { ascending: false }),
      supabase
        .from('fee_campaigns')
        .select(
          'id, scope, concept, amount, due_date, fund_type, period_month, status, created_at, cluster:clusters(name)',
        )
        .eq('condominium_id', condoId)
        .order('created_at', { ascending: false }),
      supabase
        .from('recurring_fees')
        .select(
          'id, scope, concept, due_day, fund_type, status, cluster:clusters(name), revisions:recurring_fee_revisions(base_amount, effective_from)',
        )
        .eq('condominium_id', condoId)
        .order('created_at', { ascending: false }),
      supabase
        .from('payments')
        .select(
          'id, charge_id, unit_id, amount, status, proof_url, payment_method, created_at, paid_at, unit:units(identifier, cluster_id, cluster:clusters(name)), charge:charges(concept, due_date)',
        )
        .eq('condominium_id', condoId)
        .order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select(
          'id, concept, amount, category, expense_date, vendor_name, expense_kind, status, fund_type, cluster_id, attachments:expense_attachments(id, file_url, file_name)',
        )
        .eq('condominium_id', condoId)
        .order('expense_date', { ascending: false }),
      supabase
        .from('income_entries')
        .select('id, concept, amount, category, income_date, fund_type, cluster_id, notes')
        .eq('condominium_id', condoId)
        .order('income_date', { ascending: false }),
    ]);

    setUnits((unitsRes.data as UnitOption[]) ?? []);
    setClusters((clustersRes.data as ClusterRow[]) ?? []);
    setFunds((fundsRes.data as FundBalanceRow[]) ?? []);
    setCharges((chargesRes.data as unknown as ChargeRow[]) ?? []);
    setFeeCampaigns((campaignsRes.data as unknown as FeeCampaignRow[]) ?? []);
    setRecurringFees((recurringRes.data as unknown as RecurringFeeRow[]) ?? []);
    setPayments(((paymentsRes.data as unknown as PaymentRow[]) ?? []).map(normalizePaymentRow));
    setExpenses((expensesRes.data as unknown as ExpenseRow[]) ?? []);
    setIncomeEntries((incomesRes.data as unknown as IncomeEntryRow[]) ?? []);
    setLoading(false);
  }, [selectedCondoId, supabase]);

  useEffect(() => {
    void loadCondominiums();
  }, [loadCondominiums]);

  useEffect(() => {
    setSelectedClusterId('');
  }, [selectedCondoId]);

  useEffect(() => {
    void ensureMonthlyRecurringCharges().then(() => load());
  }, [load]);

  const scopedPayments = useMemo(
    () =>
      payments.filter((payment) =>
        matchesFinanceClusterFilter(payment.unit?.cluster_id, selectedClusterId),
      ),
    [payments, selectedClusterId],
  );

  const scopedExpenses = useMemo(
    () =>
      expenses.filter((expense) =>
        matchesFinanceClusterFilter(expense.cluster_id, selectedClusterId, { condoWideApplies: true }),
      ),
    [expenses, selectedClusterId],
  );

  const scopedIncomeEntries = useMemo(
    () =>
      incomeEntries.filter((income) =>
        matchesFinanceClusterFilter(income.cluster_id, selectedClusterId, { condoWideApplies: true }),
      ),
    [incomeEntries, selectedClusterId],
  );

  const scopedCharges = useMemo(
    () =>
      charges.filter((charge) => matchesFinanceClusterFilter(charge.unit?.cluster_id, selectedClusterId)),
    [charges, selectedClusterId],
  );

  const approvedPayments = useMemo(
    () => scopedPayments.filter((p) => p.status === 'approved'),
    [scopedPayments],
  );

  const paidExpenses = useMemo(
    () => scopedExpenses.filter((e) => e.status === 'paid'),
    [scopedExpenses],
  );

  const delinquentCharges = useMemo(
    () => scopedCharges.filter((c) => c.status === 'overdue' || c.status === 'pending'),
    [scopedCharges],
  );

  const supplierExpenses = useMemo(
    () => scopedExpenses.filter((e) => e.expense_kind === 'supplier'),
    [scopedExpenses],
  );

  const payrollExpenses = useMemo(
    () => scopedExpenses.filter((e) => e.expense_kind === 'payroll'),
    [scopedExpenses],
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
    const paymentGroups = groupBy(approvedPayments, (p) => {
      const concept = p.charge?.concept ?? 'Otros ingresos';
      if (concept.toLowerCase().includes('mantenimiento')) return 'Cuotas de mantenimiento';
      if (concept.toLowerCase().includes('extraordinari')) return 'Cuotas extraordinarias';
      return 'Pagos de residentes';
    });
    const manualGroups = groupBy(scopedIncomeEntries, (income) => incomeCategoryLabel(income.category));
    const paymentRows = Object.entries(paymentGroups).map(([label, items]) => ({
      label,
      items,
      total: sumAmount(items),
      kind: 'payment' as const,
    }));
    const manualRows = Object.entries(manualGroups).map(([label, items]) => ({
      label,
      items,
      total: sumAmount(items),
      kind: 'manual' as const,
    }));
    return [...paymentRows, ...manualRows];
  }, [approvedPayments, scopedIncomeEntries]);

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

  const extraordinaryCampaigns = useMemo(
    () => feeCampaigns.filter((campaign) => campaign.scope === 'extraordinary'),
    [feeCampaigns],
  );

  const pendingReviewCount = useMemo(
    () => scopedPayments.filter((payment) => payment.status === 'pending_review').length,
    [scopedPayments],
  );

  const scopeLabel = useMemo(() => {
    if (!selectedClusterId) return 'Todo el condominio';
    return clusters.find((cluster) => cluster.id === selectedClusterId)?.name ?? 'Torre';
  }, [clusters, selectedClusterId]);

  async function reviewPayment(
    id: string,
    action: 'approve' | 'reject',
    rejectionReason?: string,
  ) {
    const res = await fetch(`/api/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rejectionReason }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'Error al procesar pago');
      return;
    }

    void load();
  }

  function runCreateIncome(formData: FormData) {
    setIncomeMessage(null);
    startIncome(async () => {
      const result = await createIncome(formData);
      if (result.error) {
        setIncomeMessage(result.error);
        return;
      }
      setIncomeMessage('Ingreso registrado.');
      void load();
    });
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
      <GlassCard className="!p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Alcance</p>
            <p className="mt-1 text-sm text-muted">
              Filtra todas las pestañas por condominio o torre. Vista actual:{' '}
              <span className="font-semibold text-[var(--text)]">{scopeLabel}</span>
            </p>
          </div>
          <FinanceScopeFilter
            condominiums={condominiums.length > 0 ? condominiums : [{ id: selectedCondoId, name: 'Condominio' }]}
            clusters={clusters}
            condominiumId={selectedCondoId}
            clusterId={selectedClusterId}
            onCondominiumChange={setSelectedCondoId}
            onClusterChange={setSelectedClusterId}
            compact
          />
        </div>
      </GlassCard>

      <div className="glass-tab-strip">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`glass-tab ${tab === item.id ? 'glass-tab-active' : ''}`}
          >
            {item.label}
            {item.id === 'movimientos' && pendingReviewCount > 0 ? (
              <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-slate-900">
                {pendingReviewCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'estado' ? (
        <FinanceEstadoPanel
          clusters={clusters}
          clusterId={selectedClusterId}
          pendingReviewCount={pendingReviewCount}
          funds={funds}
          payments={payments}
          expenses={expenses}
          incomeEntries={incomeEntries}
          charges={charges}
          totalReceivable={totalReceivable}
          totalPayables={totalPayables}
        />
      ) : null}

      {tab === 'cuotas' ? (
        <CuotasPanel
          clusters={clusters}
          units={units}
          recurringFees={recurringFees}
          extraordinaryCampaigns={extraordinaryCampaigns}
          charges={charges}
          onReload={() => void load()}
        />
      ) : null}

      {tab === 'movimientos' ? (
        <div className="space-y-6">
          <ResidentPaymentsReview
            payments={scopedPayments}
            onReview={reviewPayment}
            onViewProof={async (path) => {
              const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 3600);
              if (data?.signedUrl) window.open(data.signedUrl, '_blank');
            }}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <GlassCard>
              <h2 className="text-lg font-semibold text-[var(--text)]">Registrar ingreso manual</h2>
              <p className="mt-1 text-sm text-muted">
                Ingresos que no vienen de pagos de residentes (donaciones, servicios, etc.).
              </p>
              {incomeMessage ? (
                <p
                  className={`mt-3 text-sm ${incomeMessage.includes('registrado') ? 'text-accent' : 'text-red-300'}`}
                >
                  {incomeMessage}
                </p>
              ) : null}
              <form action={runCreateIncome} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="condominium_id" value={selectedCondoId} />
                <input name="concept" required placeholder="Concepto del ingreso" className="glass-input sm:col-span-2" />
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
                  name="income_date"
                  required
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="glass-input"
                />
                <select name="category" required className="glass-input">
                  {INCOME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900">
                      {incomeCategoryLabel(cat)}
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
                <div className="sm:col-span-2">
                  <FinanceClusterField clusters={clusters} />
                </div>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Notas (opcional)"
                  className="glass-input min-h-[72px] sm:col-span-2"
                />
                <button type="submit" disabled={incomePending} className="glass-btn-primary sm:col-span-2">
                  {incomePending ? 'Guardando…' : 'Registrar ingreso'}
                </button>
              </form>
            </GlassCard>

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
                <input type="hidden" name="condominium_id" value={selectedCondoId} />
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
              <div className="sm:col-span-2">
                <FinanceClusterField clusters={clusters} />
              </div>
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
                  buildPath={(ext) => expenseEvidencePath(selectedCondoId, expenseFileId, ext)}
                />
              </div>
              <button type="submit" disabled={expensePending} className="glass-btn-primary sm:col-span-2">
                {expensePending ? 'Guardando…' : 'Registrar egreso'}
              </button>
            </form>
          </GlassCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <h2 className="text-lg font-semibold text-[var(--text)]">Ingresos registrados</h2>
            <p className="mt-1 text-sm text-muted">
              Pagos de residentes aprobados e ingresos manuales · {scopeLabel}.
            </p>
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
                      {group.kind === 'payment'
                        ? group.items.map((payment) => (
                            <li key={payment.id} className="glass-card-deep flex justify-between gap-3 px-3 py-2 text-sm">
                              <span className="text-[var(--text)]">
                                {payment.unit?.identifier} · {payment.charge?.concept}
                              </span>
                              <span className="shrink-0 text-muted">{formatCurrency(Number(payment.amount))}</span>
                            </li>
                          ))
                        : group.items.map((income) => (
                            <li key={income.id} className="glass-card-deep flex justify-between gap-3 px-3 py-2 text-sm">
                              <span className="text-[var(--text)]">{income.concept}</span>
                              <span className="shrink-0 text-muted">{formatCurrency(Number(income.amount))}</span>
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
            <p className="mt-1 text-sm text-muted">Gastos pagados por categoría · {scopeLabel}.</p>
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

      {tab === 'cuentas' ? (
        <UnitStatementPanel
          units={units}
          clusters={clusters}
          charges={scopedCharges}
          payments={scopedPayments}
          clusterFilterId={selectedClusterId}
        />
      ) : null}

      {tab === 'proveedores' ? (
        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Pagos y adeudos a proveedores</h2>
          <p className="mt-1 text-sm text-muted">
            Estado de cuenta por proveedor · {scopeLabel}.
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
          <p className="mt-1 text-sm text-muted">Nómina y compensaciones · {scopeLabel}.</p>
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

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'amber' | 'neutral' | 'red';
}) {
  const tones = {
    green: 'border-emerald-400/25 bg-emerald-400/15 text-emerald-200',
    amber: 'border-amber-400/35 bg-amber-400/15 text-amber-100',
    neutral: 'border-white/15 bg-white/10 text-[var(--text)]',
    red: 'border-red-400/30 bg-red-400/15 text-red-100',
  };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {label}: {value}
    </span>
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
