'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ChargeStatus, FundType } from '@veka/shared';
import {
  FUND_TYPES,
  LATE_FEE_APPLY_MODES,
  LATE_FEE_TYPES,
  chargeKindLabel,
  chargeBalanceDue,
  chargeStatusLabel,
  describeLateFeeSettings,
  formatCurrency,
  fundTypeLabel,
  lateFeeApplyModeLabel,
  lateFeeTypeLabel,
  type LateFeeApplyMode,
  type LateFeeSettings,
  type LateFeeType,
} from '@veka/shared';

import {
  forgiveCharge,
  saveLateFeeSettings,
  saveOverdueReminderRule,
  sendPaymentReminder,
} from '@/app/(panel)/finanzas/actions';
import { GlassCard } from '@/components/ui/GlassCard';

interface ChargeRow {
  id: string;
  unit_id: string;
  concept: string;
  amount: number;
  amount_paid?: number;
  due_date: string;
  status: ChargeStatus;
  charge_kind: string;
  parent_charge_id: string | null;
  unit: { identifier: string; cluster_id: string | null } | null;
}

interface NotificationRuleRow {
  days_after: number | null;
  is_enabled: boolean;
  notify_push: boolean;
  notify_email: boolean;
}

interface ReminderLogRow {
  charge_id: string | null;
  sent_at: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-block text-subtle transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      ›
    </span>
  );
}

export function MorosidadPanel({
  condominiumId,
  lateFeeSettings,
  overdueReminderRule,
  reminderLog,
  morosityByCluster,
  totalReceivable,
  expandedClusters,
  onToggleCluster,
  onReload,
  onOpenUnitStatement,
}: {
  condominiumId: string;
  lateFeeSettings: LateFeeSettings;
  overdueReminderRule: NotificationRuleRow | null;
  reminderLog: ReminderLogRow[];
  morosityByCluster: [string, { clusterName: string; items: ChargeRow[]; total: number }][];
  totalReceivable: number;
  expandedClusters: Record<string, boolean>;
  onToggleCluster: (clusterId: string) => void;
  onReload: () => void;
  onOpenUnitStatement?: (unitId: string) => void;
}) {
  const [enabled, setEnabled] = useState(lateFeeSettings.enabled);
  const [graceDays, setGraceDays] = useState(String(lateFeeSettings.grace_days));
  const [feeType, setFeeType] = useState<LateFeeType>(lateFeeSettings.fee_type);
  const [feeValue, setFeeValue] = useState(String(lateFeeSettings.fee_value || ''));
  const [applyMode, setApplyMode] = useState<LateFeeApplyMode>(lateFeeSettings.apply_mode);
  const [fundType, setFundType] = useState<FundType>(lateFeeSettings.fund_type);
  const [notes, setNotes] = useState(lateFeeSettings.notes ?? '');
  const [reminderEnabled, setReminderEnabled] = useState(overdueReminderRule?.is_enabled ?? false);
  const [daysAfter, setDaysAfter] = useState(String(overdueReminderRule?.days_after ?? 7));
  const [notifyPush, setNotifyPush] = useState(overdueReminderRule?.notify_push ?? true);
  const [notifyEmail, setNotifyEmail] = useState(overdueReminderRule?.notify_email ?? true);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [chargeMessage, setChargeMessage] = useState<Record<string, string>>({});
  const [settingsPending, startSettingsSave] = useTransition();
  const [reminderPending, startReminderSave] = useTransition();
  const [reminderPendingId, setReminderPendingId] = useState<string | null>(null);
  const [forgivePendingId, setForgivePendingId] = useState<string | null>(null);

  const lastReminderByCharge = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of reminderLog) {
      if (!entry.charge_id || map.has(entry.charge_id)) continue;
      map.set(entry.charge_id, entry.sent_at);
    }
    return map;
  }, [reminderLog]);

  const previewSettings = useMemo<LateFeeSettings>(
    () => ({
      enabled,
      grace_days: Number(graceDays) || 0,
      fee_type: feeType,
      fee_value: Number(feeValue) || 0,
      apply_mode: applyMode,
      fund_type: fundType,
      notes,
    }),
    [applyMode, enabled, feeType, feeValue, fundType, graceDays, notes],
  );

  function handleSaveSettings() {
    setSettingsMessage(null);
    const formData = new FormData();
    if (enabled) formData.set('enabled', 'true');
    formData.set('condominium_id', condominiumId);
    formData.set('grace_days', graceDays);
    formData.set('fee_type', feeType);
    formData.set('fee_value', feeValue);
    formData.set('apply_mode', applyMode);
    formData.set('fund_type', fundType);
    formData.set('notes', notes);

    startSettingsSave(async () => {
      const result = await saveLateFeeSettings(formData);
      if (result.error) {
        setSettingsMessage(result.error);
        return;
      }
      setSettingsMessage('Configuración de recargos guardada.');
      onReload();
    });
  }

  function handleSaveReminderRule() {
    setReminderMessage(null);
    const formData = new FormData();
    if (reminderEnabled) formData.set('reminder_enabled', 'true');
    if (notifyPush) formData.set('notify_push', 'true');
    if (notifyEmail) formData.set('notify_email', 'true');
    formData.set('condominium_id', condominiumId);
    formData.set('days_after', daysAfter);

    startReminderSave(async () => {
      const result = await saveOverdueReminderRule(formData);
      if (result.error) {
        setReminderMessage(result.error);
        return;
      }
      setReminderMessage('Regla de recordatorio guardada.');
      onReload();
    });
  }

  async function handleSendReminder(chargeId: string) {
    setChargeMessage((prev) => ({ ...prev, [chargeId]: '' }));
    setReminderPendingId(chargeId);
    const result = await sendPaymentReminder(chargeId);
    setReminderPendingId(null);
    setChargeMessage((prev) => ({
      ...prev,
      [chargeId]: result.error ?? result.message ?? 'Recordatorio enviado.',
    }));
    if (result.success) onReload();
  }

  async function handleForgiveCharge(chargeId: string) {
    if (!confirm('¿Condonar este cargo? Dejará de aparecer en morosidad y no se podrá cobrar.')) return;
    setChargeMessage((prev) => ({ ...prev, [chargeId]: '' }));
    setForgivePendingId(chargeId);
    const result = await forgiveCharge(chargeId);
    setForgivePendingId(null);
    setChargeMessage((prev) => ({
      ...prev,
      [chargeId]: result.error ?? 'Cargo condonado.',
    }));
    if (result.success) onReload();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Recargos por mora</h2>
          <p className="mt-1 text-sm text-muted">
            Opcional. Si lo activas, se generan cargos adicionales cuando una cuota supera los días de
            gracia configurados.
          </p>

          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/10"
            />
            <span className="font-medium text-[var(--text)]">Aplicar recargos por mora</span>
          </label>

          <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${enabled ? '' : 'opacity-50'}`}>
            <label className="block text-sm">
              <span className="mb-1 block text-subtle">Días de gracia</span>
              <input
                type="number"
                min={0}
                step={1}
                value={graceDays}
                onChange={(event) => setGraceDays(event.target.value)}
                disabled={!enabled}
                className="glass-input w-full"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-subtle">Tipo de recargo</span>
              <select
                value={feeType}
                onChange={(event) => setFeeType(event.target.value as LateFeeType)}
                disabled={!enabled}
                className="glass-input w-full"
              >
                {LATE_FEE_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-slate-900">
                    {lateFeeTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-subtle">
                {feeType === 'fixed' ? 'Monto fijo (MXN)' : 'Porcentaje (%)'}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={feeValue}
                onChange={(event) => setFeeValue(event.target.value)}
                disabled={!enabled}
                className="glass-input w-full"
                placeholder={feeType === 'fixed' ? '500' : '5'}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-subtle">Frecuencia</span>
              <select
                value={applyMode}
                onChange={(event) => setApplyMode(event.target.value as LateFeeApplyMode)}
                disabled={!enabled}
                className="glass-input w-full"
              >
                {LATE_FEE_APPLY_MODES.map((mode) => (
                  <option key={mode} value={mode} className="bg-slate-900">
                    {lateFeeApplyModeLabel(mode)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-subtle">Fondo</span>
              <select
                value={fundType}
                onChange={(event) => setFundType(event.target.value as FundType)}
                disabled={!enabled}
                className="glass-input w-full"
              >
                {FUND_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-slate-900">
                    {fundTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-subtle">Notas (opcional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="glass-input w-full resize-y"
                placeholder="Ej. según reglamento interno, capítulo IV"
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-subtle">{describeLateFeeSettings(previewSettings)}</p>

          {settingsMessage ? (
            <p
              className={`mt-3 text-sm ${settingsMessage.includes('guardada') ? 'text-emerald-300' : 'text-red-300'}`}
            >
              {settingsMessage}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={settingsPending}
              className="glass-btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {settingsPending ? 'Guardando…' : 'Guardar recargos'}
            </button>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Recordatorios de cobro</h2>
          <p className="mt-1 text-sm text-muted">
            Envía recordatorios manuales por unidad o configura la regla automática diaria (push y
            correo).
          </p>

          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(event) => setReminderEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/10"
            />
            <span className="font-medium text-[var(--text)]">Recordatorio automático por mora</span>
          </label>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-subtle">Días después del vencimiento</span>
            <input
              type="number"
              min={1}
              max={365}
              value={daysAfter}
              onChange={(event) => setDaysAfter(event.target.value)}
              disabled={!reminderEnabled}
              className="glass-input w-40"
            />
          </label>

          <div className={`mt-3 space-y-2 ${reminderEnabled ? '' : 'opacity-50'}`}>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={notifyPush}
                onChange={(event) => setNotifyPush(event.target.checked)}
                disabled={!reminderEnabled}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              <span className="text-[var(--text)]">Notificación push (app móvil)</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(event) => setNotifyEmail(event.target.checked)}
                disabled={!reminderEnabled}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              <span className="text-[var(--text)]">Correo electrónico</span>
            </label>
          </div>

          {reminderMessage ? (
            <p
              className={`mt-3 text-sm ${reminderMessage.includes('guardada') ? 'text-emerald-300' : 'text-red-300'}`}
            >
              {reminderMessage}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveReminderRule}
              disabled={reminderPending}
              className="glass-btn px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {reminderPending ? 'Guardando…' : 'Guardar recordatorios'}
            </button>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="!p-4">
        <p className="text-sm text-muted">
          Unidades con cuotas vencidas, agrupadas por torre. Los recargos por mora aparecen como cargos
          separados cuando están activos.
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
                onClick={() => onToggleCluster(clusterId)}
                className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/5"
              >
                <Chevron open={open} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--text)]">{group.clusterName}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {group.items.length} cargo{group.items.length === 1 ? '' : 's'} vencido
                    {group.items.length === 1 ? '' : 's'} · {formatCurrency(group.total)}
                  </p>
                </div>
              </button>
              {open ? (
                <ul className="space-y-2 border-t border-white/10 px-4 pb-4 pt-3">
                  {group.items.map((charge) => {
                    const lastReminder = lastReminderByCharge.get(charge.id);
                    return (
                      <li
                        key={charge.id}
                        className="glass-card-deep flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text)]">
                            {charge.unit?.identifier}
                            {charge.charge_kind === 'late_fee' ? (
                              <span className="ml-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-100">
                                {chargeKindLabel(charge.charge_kind)}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-subtle">
                            {charge.concept} · vence {charge.due_date}
                          </p>
                          {lastReminder ? (
                            <p className="mt-1 text-[10px] text-subtle">
                              Último recordatorio:{' '}
                              {new Date(lastReminder).toLocaleString('es-MX', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </p>
                          ) : null}
                          {chargeMessage[charge.id] ? (
                            <p className="mt-1 text-[10px] text-emerald-300">{chargeMessage[charge.id]}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-amber-200">
                            {formatCurrency(chargeBalanceDue(charge))}
                          </span>
                          <span className="rounded-full border border-red-400/30 bg-red-400/15 px-2 py-0.5 text-xs font-bold text-red-100">
                            {chargeStatusLabel(charge.status)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleSendReminder(charge.id)}
                            disabled={reminderPendingId === charge.id || forgivePendingId === charge.id}
                            className="glass-btn px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                          >
                            {reminderPendingId === charge.id ? 'Enviando…' : 'Recordar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleForgiveCharge(charge.id)}
                            disabled={forgivePendingId === charge.id || reminderPendingId === charge.id}
                            className="glass-btn px-2.5 py-1 text-xs font-semibold text-amber-100 disabled:opacity-60"
                          >
                            {forgivePendingId === charge.id ? 'Condonando…' : 'Condonar'}
                          </button>
                          {onOpenUnitStatement && charge.unit ? (
                            <button
                              type="button"
                              onClick={() => onOpenUnitStatement(charge.unit_id)}
                              className="glass-btn px-2.5 py-1 text-xs font-semibold"
                            >
                              Estado de cuenta
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </GlassCard>
          );
        })
      )}
    </div>
  );
}
