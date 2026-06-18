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
  FEE_SCOPES,
  STORAGE_BUCKETS,
  chargeStatusLabel,
  defaultFeeConcept,
  expenseCategoryLabel,
  expenseEvidencePath,
  expenseKindLabel,
  expenseStatusLabel,
  feeCampaignStatusLabel,
  feeScopeLabel,
  formatCurrency,
  fundTypeLabel,
} from '@veka/shared';

import { cancelFeeCampaign, createExpense, createFeeCampaign } from '@/app/(panel)/finanzas/actions';
import { FinanceEstadoPanel } from '@/components/FinanceEstadoPanel';
import { FileUpload } from '@/components/ui/FileUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import { DEMO_CONDO_ID } from '@/lib/constants';

type FinanceTab = 'estado' | 'cuotas' | 'movimientos' | 'proveedores' | 'nomina' | 'morosidad';

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
  fee_campaign_id: string | null;
  unit: { identifier: string; cluster_id: string | null } | null;
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
  attachments: { id: string; file_url: string; file_name: string | null }[];
}

const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'estado', label: 'Estado financiero' },
  { id: 'cuotas', label: 'Cuotas' },
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
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null);
  const [campaignPending, startCampaign] = useTransition();

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [funds, setFunds] = useState<FundBalanceRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [feeCampaigns, setFeeCampaigns] = useState<FeeCampaignRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [feeForm, setFeeForm] = useState({
    scope: 'general' as FeeScope,
    clusterId: '',
    concept: defaultFeeConcept('general'),
    amount: '3500',
    dueDate: '',
    fundType: 'operating' as FundType,
    periodMonth: new Date().toISOString().slice(0, 7) + '-01',
  });

  const load = useCallback(async () => {
    setLoading(true);

    const [unitsRes, clustersRes, fundsRes, chargesRes, campaignsRes, paymentsRes, expensesRes] =
      await Promise.all([
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
        .select(
          'id, concept, amount, due_date, status, fee_campaign_id, unit:units(identifier, cluster_id)',
        )
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('due_date', { ascending: false }),
      supabase
        .from('fee_campaigns')
        .select(
          'id, scope, concept, amount, due_date, fund_type, period_month, status, created_at, cluster:clusters(name)',
        )
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('created_at', { ascending: false }),
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
    setFeeCampaigns((campaignsRes.data as unknown as FeeCampaignRow[]) ?? []);
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

  const campaignStats = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number; overdue: number; total: number }>();
    for (const charge of charges) {
      if (!charge.fee_campaign_id) continue;
      const stats = map.get(charge.fee_campaign_id) ?? { paid: 0, pending: 0, overdue: 0, total: 0 };
      stats.total += 1;
      if (charge.status === 'paid') stats.paid += 1;
      else if (charge.status === 'overdue') stats.overdue += 1;
      else if (charge.status === 'pending') stats.pending += 1;
      map.set(charge.fee_campaign_id, stats);
    }
    return map;
  }, [charges]);

  const affectedUnitsCount = useMemo(() => {
    if (feeForm.scope === 'cluster') {
      if (!feeForm.clusterId) return 0;
      return units.filter((u) => u.cluster_id === feeForm.clusterId).length;
    }
    if (feeForm.scope === 'extraordinary' && feeForm.clusterId) {
      return units.filter((u) => u.cluster_id === feeForm.clusterId).length;
    }
    return units.length;
  }, [feeForm.clusterId, feeForm.scope, units]);

  const activeCampaigns = useMemo(
    () => feeCampaigns.filter((c) => c.status === 'active'),
    [feeCampaigns],
  );

  function updateFeeScope(scope: FeeScope) {
    const clusterName = clusters.find((c) => c.id === feeForm.clusterId)?.name;
    setFeeForm((prev) => ({
      ...prev,
      scope,
      clusterId: scope === 'general' ? '' : prev.clusterId,
      concept: defaultFeeConcept(scope, clusterName),
    }));
  }

  function updateFeeCluster(clusterId: string) {
    const clusterName = clusters.find((c) => c.id === clusterId)?.name;
    setFeeForm((prev) => ({
      ...prev,
      clusterId,
      concept: defaultFeeConcept(prev.scope, clusterName),
    }));
  }

  function runCreateFeeCampaign(formData: FormData) {
    setCampaignMessage(null);
    startCampaign(async () => {
      const result = await createFeeCampaign(formData);
      if (result.error) {
        setCampaignMessage(result.error);
        return;
      }
      const count = 'unitCount' in result ? result.unitCount : 0;
      setCampaignMessage(`Cuota creada para ${count} unidad${count === 1 ? '' : 'es'}.`);
      setFeeForm((prev) => ({
        ...prev,
        concept: defaultFeeConcept(prev.scope, clusters.find((c) => c.id === prev.clusterId)?.name),
        dueDate: '',
      }));
      void load();
    });
  }

  function handleCancelCampaign(campaignId: string) {
    if (!confirm('¿Cancelar esta cuota? Se cancelarán los cargos pendientes de las unidades.')) return;
    setCampaignMessage(null);
    startCampaign(async () => {
      const result = await cancelFeeCampaign(campaignId);
      setCampaignMessage(result.error ?? 'Cuota cancelada.');
      void load();
    });
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
        <FinanceEstadoPanel
          funds={funds}
          payments={payments}
          expenses={expenses}
          charges={charges}
          totalReceivable={totalReceivable}
          totalPayables={totalPayables}
          onReviewPayment={reviewPayment}
          onViewProof={async (path) => {
            const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 3600);
            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
          }}
        />
      ) : null}

      {tab === 'cuotas' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <h2 className="text-lg font-semibold text-[var(--text)]">Nueva cuota</h2>
            <p className="mt-1 text-sm text-muted">
              Emite cuotas de mantenimiento general, por torre o extraordinarias a todas las unidades del
              alcance.
            </p>
            {campaignMessage ? (
              <p
                className={`mt-3 text-sm ${campaignMessage.includes('creada') || campaignMessage.includes('cancelada') ? 'text-accent' : 'text-red-300'}`}
              >
                {campaignMessage}
              </p>
            ) : null}
            <form action={runCreateFeeCampaign} className="mt-4 space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Tipo de cuota</p>
                <div className="flex flex-wrap gap-2">
                  {FEE_SCOPES.map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => updateFeeScope(scope)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        feeForm.scope === scope
                          ? 'bg-emerald-500/20 text-accent ring-1 ring-emerald-400/40'
                          : 'bg-white/5 text-muted hover:bg-white/10'
                      }`}
                    >
                      {feeScopeLabel(scope)}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="scope" value={feeForm.scope} />
              </div>

              {feeForm.scope === 'cluster' ? (
                <select
                  name="cluster_id"
                  required
                  value={feeForm.clusterId}
                  onChange={(e) => updateFeeCluster(e.target.value)}
                  className="glass-input"
                >
                  <option value="">Selecciona torre / cluster</option>
                  {clusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.id} className="bg-slate-900">
                      {cluster.name}
                    </option>
                  ))}
                </select>
              ) : feeForm.scope === 'extraordinary' ? (
                <select
                  name="cluster_id"
                  value={feeForm.clusterId}
                  onChange={(e) => updateFeeCluster(e.target.value)}
                  className="glass-input"
                >
                  <option value="" className="bg-slate-900">
                    Todo el condominio
                  </option>
                  {clusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.id} className="bg-slate-900">
                      Solo {cluster.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="hidden" name="cluster_id" value="" />
              )}

              <input
                name="concept"
                required
                value={feeForm.concept}
                onChange={(e) => setFeeForm((p) => ({ ...p, concept: e.target.value }))}
                className="glass-input"
                placeholder="Concepto"
              />
              <input
                name="amount"
                required
                type="number"
                min="0"
                step="0.01"
                value={feeForm.amount}
                onChange={(e) => setFeeForm((p) => ({ ...p, amount: e.target.value }))}
                className="glass-input"
                placeholder="Monto base por unidad (× coeficiente)"
              />
              <input
                name="due_date"
                required
                type="date"
                value={feeForm.dueDate}
                onChange={(e) => setFeeForm((p) => ({ ...p, dueDate: e.target.value }))}
                className="glass-input"
              />
              <input
                name="period_month"
                type="date"
                value={feeForm.periodMonth}
                onChange={(e) => setFeeForm((p) => ({ ...p, periodMonth: e.target.value }))}
                className="glass-input"
              />
              <select
                name="fund_type"
                value={feeForm.fundType}
                onChange={(e) => setFeeForm((p) => ({ ...p, fundType: e.target.value as FundType }))}
                className="glass-input"
              >
                <option value="operating" className="bg-slate-900">
                  {fundTypeLabel('operating')}
                </option>
                <option value="reserve" className="bg-slate-900">
                  {fundTypeLabel('reserve')}
                </option>
              </select>
              <p className="text-xs text-subtle">
                Se generarán cargos para{' '}
                <span className="font-semibold text-[var(--text)]">{affectedUnitsCount}</span> unidad
                {affectedUnitsCount === 1 ? '' : 'es'}, cada una según su coeficiente.
              </p>
              <button type="submit" disabled={campaignPending || affectedUnitsCount === 0} className="glass-btn-primary">
                {campaignPending ? 'Emitiendo…' : 'Emitir cuota'}
              </button>
            </form>
          </GlassCard>

          <GlassCard>
            <h2 className="text-lg font-semibold text-[var(--text)]">Cuotas activas</h2>
            <p className="mt-1 text-sm text-muted">Registro de cuotas emitidas y cobranza por unidad.</p>
            <div className="mt-4 space-y-3">
              {activeCampaigns.length === 0 ? (
                <p className="text-sm text-subtle">No hay cuotas activas.</p>
              ) : (
                activeCampaigns.map((campaign) => {
                  const stats = campaignStats.get(campaign.id) ?? {
                    paid: 0,
                    pending: 0,
                    overdue: 0,
                    total: 0,
                  };
                  return (
                    <div key={campaign.id} className="glass-card-deep p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--text)]">{campaign.concept}</p>
                          <p className="mt-1 text-xs text-subtle">
                            {feeScopeLabel(campaign.scope)}
                            {campaign.cluster?.name ? ` · ${campaign.cluster.name}` : ''}
                            {' · '}
                            {formatCurrency(Number(campaign.amount))} base / unidad
                            {' · '}
                            Vence {campaign.due_date}
                          </p>
                        </div>
                        <span className="glass-tag-green">{feeCampaignStatusLabel(campaign.status)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <StatChip label="Unidades" value={stats.total} tone="neutral" />
                        <StatChip label="Pagadas" value={stats.paid} tone="green" />
                        <StatChip label="Pendientes" value={stats.pending} tone="amber" />
                        {stats.overdue > 0 ? (
                          <StatChip label="Vencidas" value={stats.overdue} tone="red" />
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={campaignPending}
                        onClick={() => handleCancelCampaign(campaign.id)}
                        className="mt-3 text-xs text-red-300 hover:underline"
                      >
                        Cancelar cuota
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {feeCampaigns.some((c) => c.status === 'cancelled') ? (
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Historial</p>
                <ul className="space-y-2">
                  {feeCampaigns
                    .filter((c) => c.status === 'cancelled')
                    .map((campaign) => (
                      <li key={campaign.id} className="text-sm text-subtle">
                        {campaign.concept} · {feeCampaignStatusLabel(campaign.status)}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </GlassCard>
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
