'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { ChargeStatus } from '@veka/shared';
import {
  buildNextPaymentGroup,
  chargeBalanceDue,
  chargeStatusLabel,
  formatCurrency,
  unitTotalBalanceDue,
  type ChargeForSettlement,
} from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';

interface ChargeRow extends ChargeForSettlement {
  concept: string;
}

export function ResidentPayOnlineButton({
  chargeId,
  amount,
  maxAmount,
  disabled,
}: {
  chargeId: string;
  amount: number;
  maxAmount: number;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePay() {
    setMessage(null);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Indica un monto mayor a cero.');
      return;
    }
    if (amount > maxAmount + 0.01) {
      setMessage(`El monto no puede exceder ${formatCurrency(maxAmount)}.`);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/payments/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chargeId, amount }),
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

  const isPartial = amount < maxAmount - 0.01;

  return (
    <div>
      <button
        type="button"
        onClick={handlePay}
        disabled={disabled || pending}
        className="glass-btn-primary w-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {pending
          ? 'Abriendo pasarela…'
          : isPartial
            ? `Pagar abono ${formatCurrency(amount)}`
            : 'Pagar en línea'}
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
  const groupMax = paymentGroup?.totalAmount ?? 0;
  const balanceDue = unitTotalBalanceDue(charges);

  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    setPayAmount(groupMax > 0 ? String(groupMax) : '');
  }, [groupMax, nextCharge?.id]);

  const parsedAmount = useMemo(() => Number(payAmount.replace(/,/g, '')), [payAmount]);
  const isPartial =
    Number.isFinite(parsedAmount) && groupMax > 0 && parsedAmount < groupMax - 0.01;

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
          <p className="mt-2 text-3xl font-bold text-accent">{formatCurrency(groupMax)}</p>
          {paymentGroup && paymentGroup.relatedCharges.length > 0 ? (
            <p className="mt-1 text-sm text-amber-200">
              Incluye {paymentGroup.relatedCharges.length} recargo(s) por mora
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted">
            {(charges.find((c) => c.id === nextCharge.id) as ChargeRow | undefined)?.concept}
          </p>
          <p className="text-sm text-subtle">
            Vence {nextCharge.due_date} · {chargeStatusLabel(nextCharge.status as ChargeStatus)}
          </p>

          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-subtle">Monto a pagar (abono parcial permitido)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={groupMax}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="glass-input w-full"
              />
            </label>
            <p className="text-xs text-subtle">
              Máximo para este grupo: {formatCurrency(groupMax)}
              {isPartial ? ` · Abono parcial de ${formatCurrency(parsedAmount)}` : ''}
            </p>
            <ResidentPayOnlineButton
              chargeId={nextCharge.id}
              amount={parsedAmount}
              maxAmount={groupMax}
              disabled={!Number.isFinite(parsedAmount) || parsedAmount <= 0}
            />
          </div>

          <p className="mt-3 text-xs text-subtle">
            También puedes pagar desde la app móvil subiendo tu comprobante de transferencia.
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
          {charges.map((charge) => {
            const balance = chargeBalanceDue(charge);
            const paid = Number(charge.amount) - balance;
            return (
              <li
                key={charge.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium text-[var(--text)]">{charge.concept}</p>
                  <p className="text-sm text-subtle">
                    Vence {charge.due_date} · {chargeStatusLabel(charge.status as ChargeStatus)}
                    {paid > 0 && balance > 0
                      ? ` · Abonado ${formatCurrency(paid)}`
                      : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--text)]">
                    {balance > 0 ? formatCurrency(balance) : formatCurrency(Number(charge.amount))}
                  </p>
                  {paid > 0 && balance > 0 ? (
                    <p className="text-xs text-subtle">de {formatCurrency(Number(charge.amount))}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </div>
  );
}
