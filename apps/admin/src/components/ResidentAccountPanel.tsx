'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { ActivePaymentPlan, ChargeStatus } from '@veka/shared';
import {
  chargeBalanceDue,
  chargeStatusLabel,
  formatCurrency,
  installmentBalanceDue,
  installmentStatusLabel,
  planInstallmentsProgress,
  resolveNextPaymentTarget,
  unitTotalBalanceDue,
  type ChargeForSettlement,
} from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';

type PaymentMode = 'transfer' | 'online';

interface ChargeRow extends ChargeForSettlement {
  concept: string;
}

export function ResidentPayTransferForm({
  chargeId,
  installmentId,
  condominiumId,
  unitId,
  amount,
  maxAmount,
  disabled,
}: {
  chargeId: string;
  installmentId?: string;
  condominiumId: string;
  unitId: string;
  amount: number;
  maxAmount: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setMessage(null);
    setSuccess(null);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Indica un monto mayor a cero.');
      return;
    }
    if (amount > maxAmount + 0.01) {
      setMessage(`El monto no puede exceder ${formatCurrency(maxAmount)}.`);
      return;
    }

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage('Selecciona el comprobante de transferencia (imagen o PDF).');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${condominiumId}/${unitId}/${chargeId}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });

        if (uploadError) throw uploadError;

        const { error: paymentError } = await supabase.from('payments').insert({
          charge_id: chargeId,
          condominium_id: condominiumId,
          unit_id: unitId,
          amount,
          proof_url: path,
          payment_method: 'transfer',
          paid_at: new Date().toISOString(),
          ...(installmentId ? { payment_plan_installment_id: installmentId } : {}),
        });

        if (paymentError) throw paymentError;

        setSuccess(
          amount < maxAmount - 0.01
            ? `Abono de ${formatCurrency(amount)} enviado. La administración lo revisará pronto.`
            : 'Comprobante enviado. La administración revisará tu pago pronto.',
        );
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo subir el comprobante.');
      }
    });
  }

  const isPartial = amount < maxAmount - 0.01;

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-subtle">Comprobante de transferencia</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="glass-input w-full file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-[var(--text)]"
        />
      </label>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || pending}
        className="glass-btn-primary w-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {pending
          ? 'Enviando…'
          : isPartial
            ? `Enviar abono ${formatCurrency(amount)}`
            : 'Enviar comprobante'}
      </button>
      {success ? <p className="text-sm text-accent">{success}</p> : null}
      {message ? <p className="text-sm text-red-300">{message}</p> : null}
    </div>
  );
}

export function ResidentPaymentForm({
  chargeId,
  installmentId,
  condominiumId,
  unitId,
  amount,
  maxAmount,
  disabled,
}: {
  chargeId: string;
  installmentId?: string;
  condominiumId: string;
  unitId: string;
  amount: number;
  maxAmount: number;
  disabled?: boolean;
}) {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('transfer');
  const [paymentMethod, setPaymentMethod] = useState<'all' | 'card' | 'oxxo' | 'spei'>('all');

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-subtle">Forma de pago</span>
        <select
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          className="glass-input w-full"
        >
          <option value="transfer" className="bg-slate-900">
            Transferencia bancaria (subir comprobante)
          </option>
          <option value="online" className="bg-slate-900">
            Tarjeta, Oxxo o SPEI (en línea)
          </option>
        </select>
      </label>

      {paymentMode === 'transfer' ? (
        <ResidentPayTransferForm
          chargeId={chargeId}
          installmentId={installmentId}
          condominiumId={condominiumId}
          unitId={unitId}
          amount={amount}
          maxAmount={maxAmount}
          disabled={disabled}
        />
      ) : (
        <ResidentPayOnlineButton
          chargeId={chargeId}
          installmentId={installmentId}
          amount={amount}
          maxAmount={maxAmount}
          disabled={disabled}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
        />
      )}
    </div>
  );
}

export function ResidentPayOnlineButton({
  chargeId,
  installmentId,
  amount,
  maxAmount,
  disabled,
  paymentMethod,
  onPaymentMethodChange,
}: {
  chargeId: string;
  installmentId?: string;
  amount: number;
  maxAmount: number;
  disabled?: boolean;
  paymentMethod: 'all' | 'card' | 'oxxo' | 'spei';
  onPaymentMethodChange: (value: 'all' | 'card' | 'oxxo' | 'spei') => void;
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
          body: JSON.stringify({
            ...(installmentId ? { installmentId, chargeId } : { chargeId }),
            amount,
            paymentMethod,
          }),
        });
        const payload = (await response.json()) as {
          url?: string;
          error?: string;
          awaitingPayment?: boolean;
          gatewayReference?: string | null;
        };
        if (!response.ok || !payload.url) {
          throw new Error(payload.error ?? 'No se pudo iniciar el pago');
        }
        if (payload.awaitingPayment && payload.gatewayReference) {
          setMessage(`Referencia generada: ${payload.gatewayReference}. Completa el pago en la pasarela.`);
        }
        window.location.href = payload.url;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Error al abrir la pasarela');
      }
    });
  }

  const isPartial = amount < maxAmount - 0.01;

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-subtle">Método en línea</span>
        <select
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value as typeof paymentMethod)}
          className="glass-input w-full"
        >
          <option value="all" className="bg-slate-900">Tarjeta, Oxxo o SPEI</option>
          <option value="card" className="bg-slate-900">Solo tarjeta</option>
          <option value="oxxo" className="bg-slate-900">Oxxo</option>
          <option value="spei" className="bg-slate-900">SPEI</option>
        </select>
      </label>
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
  condominiumId,
  unitId,
  charges,
  activePlan,
}: {
  unitLabel: string;
  condominiumName: string;
  condominiumId: string;
  unitId: string;
  charges: ChargeRow[];
  activePlan?: ActivePaymentPlan | null;
}) {
  const paymentTarget = resolveNextPaymentTarget(charges, activePlan ?? null);
  const groupMax = paymentTarget?.maxAmount ?? 0;
  const balanceDue = unitTotalBalanceDue(charges);
  const planProgress = activePlan ? planInstallmentsProgress(activePlan.installments) : null;

  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    setPayAmount(groupMax > 0 ? String(groupMax) : '');
  }, [groupMax, paymentTarget?.chargeId, paymentTarget?.installmentId]);

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

      {activePlan ? (
        <GlassCard>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Plan de pago activo</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text)]">{activePlan.title}</p>
          {planProgress ? (
            <p className="mt-1 text-sm text-muted">
              {planProgress.paidCount} de {planProgress.totalCount} parcialidades pagadas
              {planProgress.percent !== null ? ` · ${planProgress.percent}% cubierto` : ''}
            </p>
          ) : null}
          <ul className="mt-4 space-y-2">
            {[...activePlan.installments]
              .sort((a, b) => a.installment_number - b.installment_number)
              .map((installment) => {
                const balance = installmentBalanceDue(installment);
                return (
                  <li
                    key={installment.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-sm last:border-0"
                  >
                    <span className="text-[var(--text)]">
                      Parcialidad {installment.installment_number} · vence {installment.due_date}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">
                        {balance > 0 ? formatCurrency(balance) : formatCurrency(Number(installment.amount))}
                      </span>
                      <span className="text-xs text-subtle">{installmentStatusLabel(installment.status)}</span>
                    </span>
                  </li>
                );
              })}
          </ul>
        </GlassCard>
      ) : null}

      {paymentTarget ? (
        <GlassCard>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
            {paymentTarget.kind === 'installment' ? 'Próxima parcialidad' : 'Próximo pago'}
          </p>
          <p className="mt-2 text-3xl font-bold text-accent">{formatCurrency(groupMax)}</p>
          <p className="mt-2 text-sm text-muted">{paymentTarget.label}</p>
          <p className="text-sm text-subtle">
            Vence {paymentTarget.dueDate}
            {paymentTarget.kind === 'charges' ? (
              <>
                {' '}
                ·{' '}
                {chargeStatusLabel(
                  (charges.find((c) => c.id === paymentTarget.chargeId)?.status ?? 'pending') as ChargeStatus,
                )}
              </>
            ) : null}
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
              Máximo: {formatCurrency(groupMax)}
              {isPartial ? ` · Abono parcial de ${formatCurrency(parsedAmount)}` : ''}
            </p>
            <ResidentPaymentForm
              chargeId={paymentTarget.chargeId}
              installmentId={paymentTarget.installmentId}
              condominiumId={condominiumId}
              unitId={unitId}
              amount={parsedAmount}
              maxAmount={groupMax}
              disabled={!Number.isFinite(parsedAmount) || parsedAmount <= 0}
            />
          </div>
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
