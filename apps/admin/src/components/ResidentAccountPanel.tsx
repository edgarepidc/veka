'use client';

import { useState, useTransition } from 'react';
import {
  buildNextPaymentGroup,
  chargeStatusLabel,
  formatCurrency,
  type ChargeForSettlement,
} from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';

interface ChargeRow extends ChargeForSettlement {
  concept: string;
}

export function ResidentPayOnlineButton({
  chargeId,
  disabled,
}: {
  chargeId: string;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePay() {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/payments/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chargeId }),
        });
        const payload = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !payload.url) {
          throw new Error(payload.error ?? 'No se pudo iniciar el pago');
        }
        window.location.href = payload.url;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Error al abrir la pasarela');
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePay}
        disabled={disabled || pending}
        className="glass-btn-primary w-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? 'Abriendo pasarela…' : 'Pagar en línea'}
      </button>
      {message ? <p className="mt-2 text-sm text-red-300">{message}</p> : null}
    </div>
  );
}

export function ResidentAccountPanel({
  unitLabel,
  condominiumName,
  charges,
}: {
  unitLabel: string;
  condominiumName: string;
  charges: ChargeRow[];
}) {
  const paymentGroup = buildNextPaymentGroup(charges);
  const nextCharge = paymentGroup?.primaryCharge ?? null;
  const balanceDue = charges
    .filter((charge) => charge.status === 'pending' || charge.status === 'overdue')
    .reduce((sum, charge) => sum + Number(charge.amount), 0);

  return (
    <div className="space-y-6">
      <GlassCard>
        <p className="text-sm text-muted">
          {condominiumName} · Unidad {unitLabel}
        </p>
        <p className="mt-2 text-2xl font-bold text-[var(--text)]">{formatCurrency(balanceDue)}</p>
        <p className="text-sm text-subtle">Saldo pendiente total</p>
      </GlassCard>

      {nextCharge ? (
        <GlassCard>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Próximo pago</p>
          <p className="mt-2 text-3xl font-bold text-accent">
            {formatCurrency(paymentGroup?.totalAmount ?? 0)}
          </p>
          {paymentGroup && paymentGroup.relatedCharges.length > 0 ? (
            <p className="mt-1 text-sm text-amber-200">
              Incluye {paymentGroup.relatedCharges.length} recargo(s) por mora
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted">
            {(charges.find((c) => c.id === nextCharge.id) as ChargeRow | undefined)?.concept}
          </p>
          <p className="text-sm text-subtle">
            Vence {nextCharge.due_date} · {chargeStatusLabel(nextCharge.status)}
          </p>
          <div className="mt-4">
            <ResidentPayOnlineButton chargeId={nextCharge.id} />
          </div>
          <p className="mt-3 text-xs text-subtle">
            También puedes pagar desde la app móvil Veka subiendo tu comprobante de transferencia.
          </p>
        </GlassCard>
      ) : (
        <GlassCard>
          <p className="text-sm text-muted">No tienes cargos pendientes. ¡Estás al corriente!</p>
        </GlassCard>
      )}

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Mis cargos</h2>
        <ul className="mt-4 space-y-3">
          {charges.map((charge) => (
            <li
              key={charge.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 last:border-0"
            >
              <div>
                <p className="font-medium text-[var(--text)]">{charge.concept}</p>
                <p className="text-sm text-subtle">
                  Vence {charge.due_date} · {chargeStatusLabel(charge.status)}
                </p>
              </div>
              <p className="font-semibold text-[var(--text)]">{formatCurrency(Number(charge.amount))}</p>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
