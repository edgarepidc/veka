'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChargeStatus, PaymentStatus } from '@veka/shared';
import {
  STORAGE_BUCKETS,
  buildUnitStatementWithBalance,
  chargeStatusLabel,
  delinquentBalance,
  formatCurrency,
  formatExportDate,
  paymentStatusLabel,
  resolveStorageImageUrl,
  type UnitStatementExport,
} from '@veka/shared';

import { ExportMenu } from '@/components/ExportMenu';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  downloadUnitStatementCsv,
  exportUnitStatementPdf,
} from '@/lib/finance-export-client';
import type { CondominiumBranding } from '@/lib/condominium-settings';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

interface UnitOption {
  id: string;
  identifier: string;
  cluster_id: string | null;
}

interface ClusterRow {
  id: string;
  name: string;
}

interface ChargeRow {
  id: string;
  unit_id: string;
  concept: string;
  amount: number;
  amount_paid?: number;
  due_date: string;
  status: string;
  unit: { identifier: string; cluster_id: string | null } | null;
}

interface PaymentRow {
  id: string;
  charge_id: string;
  unit_id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export function UnitStatementPanel({
  condominiumName,
  units,
  clusters,
  charges,
  payments,
  clusterFilterId,
  initialUnitId = '',
  branding,
}: {
  condominiumName: string;
  units: UnitOption[];
  clusters: ClusterRow[];
  charges: ChargeRow[];
  payments: PaymentRow[];
  clusterFilterId: string;
  initialUnitId?: string;
  branding?: CondominiumBranding;
}) {
  const visibleUnits = useMemo(() => {
    if (!clusterFilterId) return units;
    return units.filter((unit) => unit.cluster_id === clusterFilterId);
  }, [clusterFilterId, units]);

  const [selectedUnitId, setSelectedUnitId] = useState('');

  useEffect(() => {
    setSelectedUnitId('');
  }, [clusterFilterId]);

  useEffect(() => {
    if (initialUnitId) setSelectedUnitId(initialUnitId);
  }, [initialUnitId]);

  const activeUnitId = selectedUnitId || visibleUnits[0]?.id || '';

  const clusterMap = useMemo(() => new Map(clusters.map((c) => [c.id, c.name])), [clusters]);

  const statement = useMemo(() => {
    const filteredCharges = charges
      .filter((charge) => charge.unit_id === activeUnitId)
      .map((charge) => ({
        id: charge.id,
        concept: charge.concept,
        amount: Number(charge.amount),
        due_date: charge.due_date,
        status: charge.status,
      }));

    const unitPayments = payments
      .filter((payment) => payment.unit_id === activeUnitId)
      .map((payment) => ({
        id: payment.id,
        charge_id: payment.charge_id,
        amount: Number(payment.amount),
        status: payment.status,
        paid_at: payment.paid_at,
        created_at: payment.created_at,
      }));

    return buildUnitStatementWithBalance(filteredCharges, unitPayments);
  }, [activeUnitId, charges, payments]);

  const delinquentDue = useMemo(() => {
    if (!activeUnitId) return 0;
    const filteredCharges = charges
      .filter((charge) => charge.unit_id === activeUnitId)
      .map((charge) => ({
        amount: Number(charge.amount),
        amount_paid: Number(charge.amount_paid ?? 0),
        due_date: charge.due_date,
        status: charge.status,
      }));
    return delinquentBalance(filteredCharges);
  }, [activeUnitId, charges]);

  const activeUnit = units.find((u) => u.id === activeUnitId);

  const exportStatement = useMemo<UnitStatementExport | null>(() => {
    if (!activeUnit) return null;
    return {
      condominiumName,
      unitIdentifier: activeUnit.identifier,
      clusterName: activeUnit.cluster_id
        ? (clusterMap.get(activeUnit.cluster_id) ?? '—')
        : 'General',
      balanceDue: statement.balanceDue,
      generatedAt: formatExportDate(),
      branding: {
        logoUrl: resolveStorageImageUrl(
          SUPABASE_URL,
          branding?.logo_url,
          STORAGE_BUCKETS.BRANDING,
        ),
        primaryColor: branding?.primary_color,
        accentColor: branding?.accent_color,
      },
      lines: statement.lines.map((line) => ({
        date: line.date,
        concept: line.concept,
        debit: line.debit,
        credit: line.credit,
        runningBalance: line.runningBalance,
        status:
          line.kind === 'charge'
            ? chargeStatusLabel(line.status as ChargeStatus)
            : paymentStatusLabel(line.status as PaymentStatus),
      })),
    };
  }, [activeUnit, branding, clusterMap, condominiumName, statement]);

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Estado de cuenta por unidad</h2>
            <p className="mt-1 text-sm text-muted">
              Historial de cargos y pagos con saldo acumulado por unidad. Incluye mantenimiento fijo,
              consumos variables (gas, etc.) y cuotas extraordinarias.
            </p>
          </div>
          <select
            value={activeUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className="glass-input min-w-[200px]"
          >
            {visibleUnits.map((unit) => (
              <option key={unit.id} value={unit.id} className="bg-slate-900">
                {unit.identifier}
                {unit.cluster_id
                  ? ` · ${clusterMap.get(unit.cluster_id) ?? 'Torre'}`
                  : ''}
              </option>
            ))}
          </select>
          {exportStatement ? (
            <ExportMenu
              disabled={exportStatement.lines.length === 0}
              onCsv={() => downloadUnitStatementCsv(exportStatement)}
              onPdf={() => exportUnitStatementPdf(exportStatement)}
            />
          ) : null}
        </div>

        {activeUnit ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox label="Unidad" value={activeUnit.identifier} />
            <StatBox
              label="Torre"
              value={
                activeUnit.cluster_id
                  ? (clusterMap.get(activeUnit.cluster_id) ?? '—')
                  : 'General'
              }
            />
            <StatBox
              label="Saldo total pendiente"
              value={formatCurrency(statement.balanceDue)}
              highlight={statement.balanceDue > 0}
            />
            <StatBox
              label="Saldo vencido"
              value={formatCurrency(delinquentDue)}
              highlight={delinquentDue > 0}
            />
          </div>
        ) : null}
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-subtle">
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Concepto</th>
              <th className="px-3 py-2 font-semibold text-right">Cargo</th>
              <th className="px-3 py-2 font-semibold text-right">Abono</th>
              <th className="px-3 py-2 font-semibold text-right">Saldo</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-subtle">
                  Sin movimientos para esta unidad.
                </td>
              </tr>
            ) : (
              statement.lines.map((line) => (
                <tr key={line.id} className="border-b border-white/5">
                  <td className="px-3 py-3 text-muted">{line.date}</td>
                  <td className="px-3 py-3 text-[var(--text)]">{line.concept}</td>
                  <td className="px-3 py-3 text-right font-semibold text-warning">
                    {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-accent">
                    {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-[var(--text)]">
                    {formatCurrency(line.runningBalance)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusTag kind={line.kind} status={line.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="glass-card-deep p-3">
      <p className="text-xs uppercase tracking-wide text-subtle">{label}</p>
      <p className={`mt-1 text-lg font-bold ${highlight ? 'text-warning' : 'text-[var(--text)]'}`}>
        {value}
      </p>
    </div>
  );
}

function StatusTag({ kind, status }: { kind: 'charge' | 'payment'; status: string }) {
  if (kind === 'charge') {
    const tone =
      status === 'paid'
        ? 'text-accent'
        : status === 'overdue'
          ? 'text-danger'
          : status === 'cancelled' || status === 'forgiven'
            ? 'text-muted'
            : 'text-warning';
    return (
      <span className={`text-xs font-semibold ${tone}`}>
        {chargeStatusLabel(status as ChargeStatus)}
      </span>
    );
  }

  const paymentTone =
    status === 'approved'
      ? 'text-accent'
      : status === 'rejected'
        ? 'text-danger'
        : 'text-warning';

  return (
    <span className={`text-xs font-semibold ${paymentTone}`}>
      {paymentStatusLabel(status as PaymentStatus)}
    </span>
  );
}
