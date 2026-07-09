'use client';

import { useMemo, useState } from 'react';
import type { PaymentStatus } from '@veka/shared';
import { formatCurrency, paymentAccentTone, paymentStatusLabel, paymentTagTone } from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import { StatusTag } from '@/components/ui/StatusTag';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HELP } from '@/lib/help-content';

export interface ResidentPaymentRow {
  id: string;
  amount: number;
  status: PaymentStatus;
  proof_url: string | null;
  payment_method: string | null;
  gateway_method: string | null;
  gateway_reference: string | null;
  created_at: string;
  paid_at: string | null;
  first_reviewed_at: string | null;
  unit: {
    identifier: string;
    cluster_id: string | null;
    cluster: { name: string } | null;
  } | null;
  charge: { concept: string; due_date: string } | null;
}

function paymentMethodLabel(method: string | null, gatewayMethod: string | null): string {
  if (gatewayMethod === 'oxxo') return 'Oxxo (en línea)';
  if (gatewayMethod === 'spei') return 'SPEI (en línea)';
  if (!method) return 'Transferencia';
  const labels: Record<string, string> = {
    transfer: 'Transferencia bancaria',
    card: 'Tarjeta',
    cash: 'Efectivo',
    gateway: 'Pasarela de pago',
  };
  return labels[method] ?? method;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function ResidentPaymentsReview({
  payments,
  onReview,
  onViewProof,
}: {
  payments: ResidentPaymentRow[];
  onReview: (id: string, action: 'approve' | 'reject', rejectionReason?: string) => void;
  onViewProof: (path: string) => void;
}) {
  const pending = payments.filter((payment) => payment.status === 'pending_review');
  const secondReview = payments.filter((payment) => payment.status === 'pending_second_review');
  const awaiting = payments.filter((payment) => payment.status === 'awaiting_payment');
  const history = payments
    .filter((payment) => payment.status === 'approved' || payment.status === 'rejected')
    .slice(0, 12);

  function handleReject(id: string) {
    const reason = window.prompt('Motivo del rechazo (opcional):') ?? undefined;
    if (!window.confirm('¿Rechazar este comprobante de pago?')) return;
    onReview(id, 'reject', reason);
  }

  return (
    <div className="space-y-6">
      <GlassCard className={pending.length > 0 ? 'ring-1 ring-amber-400/30' : ''}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionHeading help={HELP.pagos.validar}>Pagos de residentes por validar</SectionHeading>
            <p className="mt-1 text-sm text-muted">
              Transferencias con comprobante y primera aprobación del flujo maker-checker.
            </p>
          </div>
          {pending.length > 0 ? (
            <span className="rounded-full border border-amber-400/35 bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-100">
              {pending.length} pendiente{pending.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <p className="text-sm text-subtle">No hay comprobantes pendientes de revisión.</p>
          ) : (
            pending.map((payment) => (
              <PaymentReviewCard
                key={payment.id}
                payment={payment}
                approveLabel="Aprobar (1ª revisión o final)"
                onApprove={() => onReview(payment.id, 'approve')}
                onReject={() => handleReject(payment.id)}
                onViewProof={onViewProof}
              />
            ))
          )}
        </div>
      </GlassCard>

      {secondReview.length > 0 ? (
        <GlassCard className="ring-1 ring-sky-400/30">
          <SectionHeading help={HELP.pagos.segunda}>Segunda aprobación requerida</SectionHeading>
          <p className="mt-1 text-sm text-muted">
            Un administrador distinto debe confirmar estos pagos para liquidar cargos.
          </p>
          <div className="mt-4 space-y-3">
            {secondReview.map((payment) => (
              <PaymentReviewCard
                key={payment.id}
                payment={payment}
                approveLabel="Confirmar 2ª aprobación"
                onApprove={() => onReview(payment.id, 'approve')}
                onReject={() => handleReject(payment.id)}
                onViewProof={onViewProof}
              />
            ))}
          </div>
        </GlassCard>
      ) : null}

      {awaiting.length > 0 ? (
        <GlassCard>
          <SectionHeading help={HELP.pagos.oxxoSpei}>Esperando Oxxo / SPEI</SectionHeading>
          <p className="mt-1 text-sm text-muted">Referencias abiertas en Stripe. Se aprobarán al recibir el abono.</p>
          <div className="mt-4 space-y-3">
            {awaiting.map((payment) => (
              <div key={payment.id} className="glass-card-deep p-4 text-sm">
                <p className="font-semibold text-[var(--text)]">
                  {payment.unit?.identifier} · {formatCurrency(Number(payment.amount))}
                </p>
                <p className="text-muted">
                  {paymentMethodLabel(payment.payment_method, payment.gateway_method)}
                  {payment.gateway_reference ? ` · Ref: ${payment.gateway_reference}` : ''}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}

      <GlassCard>
        <SectionHeading as="h3" className="text-base font-semibold text-[var(--text)]" help={HELP.pagos.historial}>
          Historial de validaciones
        </SectionHeading>
        <div className="mt-4 space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-subtle">Aún no hay pagos validados.</p>
          ) : (
            history.map((payment) => (
              <div
                key={payment.id}
                className="glass-card-deep flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {payment.unit?.identifier ?? 'Unidad'} · {formatCurrency(Number(payment.amount))}
                  </p>
                  <p className="text-xs text-subtle">
                    {payment.charge?.concept ?? 'Cuota de mantenimiento'}
                    {' · '}
                    {formatDateTime(payment.paid_at ?? payment.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={payment.status} />
                  {payment.proof_url ? (
                    <button
                      type="button"
                      onClick={() => onViewProof(payment.proof_url!)}
                      className="text-xs text-accent hover:underline"
                    >
                      Comprobante
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function PaymentReviewCard({
  payment,
  approveLabel,
  onApprove,
  onReject,
  onViewProof,
}: {
  payment: ResidentPaymentRow;
  approveLabel: string;
  onApprove: () => void;
  onReject: () => void;
  onViewProof: (path: string) => void;
}) {
  const accent = paymentAccentTone(payment.status);
  return (
    <div className={`glass-card glass-card-accent glass-card-accent-${accent} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--text)]">
            Unidad {payment.unit?.identifier ?? '—'} · {formatCurrency(Number(payment.amount))}
          </p>
          <p className="mt-1 text-sm text-muted">{payment.charge?.concept ?? 'Cuota de mantenimiento'}</p>
          <p className="mt-1 text-xs text-subtle">
            {paymentMethodLabel(payment.payment_method, payment.gateway_method)}
            {' · '}
            Enviado {formatDateTime(payment.created_at)}
            {payment.first_reviewed_at
              ? ` · 1ª aprobación ${formatDateTime(payment.first_reviewed_at)}`
              : ''}
          </p>
        </div>
        <StatusTag label={paymentStatusLabel(payment.status)} tone={paymentTagTone(payment.status)} />
      </div>

      {payment.proof_url ? (
        <button
          type="button"
          onClick={() => onViewProof(payment.proof_url!)}
          className="mt-3 inline-flex text-sm text-accent-2 hover:underline"
        >
          Ver comprobante (imagen o PDF)
        </button>
      ) : payment.payment_method === 'gateway' ? (
        <p className="mt-3 text-xs text-amber-200/80">
          Intento de pago en línea sin completar. Si el residente no terminó en Stripe, recházalo; los pagos
          exitosos por pasarela se aprueban solos.
        </p>
      ) : (
        <p className="mt-3 text-xs text-subtle">Sin comprobante adjunto.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {approveLabel}
        </button>
        <button
          type="button"
          onClick={onReject}
          className="rounded-lg border border-red-400/40 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/10"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: PaymentStatus }) {
  return <StatusTag label={paymentStatusLabel(status)} tone={paymentTagTone(status)} />;
}
