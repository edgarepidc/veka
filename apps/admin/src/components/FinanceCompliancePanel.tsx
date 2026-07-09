'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ApprovalSettings } from '@veka/shared';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  expenseCategoryLabel,
  formatCurrency,
  incomeCategoryLabel,
  isCfdiBillingEnabled,
} from '@veka/shared';

import {
  deleteAccountingCategoryMap,
  saveAccountingCategoryMap,
  saveApprovalSettings,
  saveFiscalProfile,
  saveUnitTaxProfile,
  seedDefaultAccountingMaps,
  updateAccountingCategoryMap,
} from '@/app/(panel)/finanzas/fiscal-actions';
import { GlassCard } from '@/components/ui/GlassCard';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HELP } from '@/lib/help-content';

interface UnitOption {
  id: string;
  identifier: string;
}

interface FiscalProfileRow {
  legal_name: string;
  rfc: string;
  tax_regime: string;
  postal_code: string;
  default_series: string;
  auto_invoice_on_approve: boolean;
  pac_organization_id: string | null;
}

interface UnitTaxRow {
  unit_id: string;
  legal_name: string;
  rfc: string;
  postal_code: string;
  cfdi_use: string;
  email: string | null;
  tax_regime: string | null;
}

interface AccountingMapRow {
  id: string;
  movement_type: 'income' | 'expense';
  veka_category: string;
  account_code: string;
  account_name: string | null;
  fund_type: string | null;
}

interface CfdiInvoiceRow {
  id: string;
  status: string;
  uuid_fiscal: string | null;
  series: string | null;
  folio: string | null;
  total: number;
  pdf_url: string | null;
  created_at: string;
  unit: { identifier: string } | null;
}

export function FinanceCompliancePanel({
  condominiumId,
  approvalSettings,
  fiscalProfile,
  unitTaxProfiles,
  accountingMaps,
  cfdiInvoices,
  units,
  pendingSecondReviewCount = 0,
  onReload,
  onOpenPaymentsReview,
}: {
  condominiumId: string;
  approvalSettings: ApprovalSettings;
  fiscalProfile: FiscalProfileRow | null;
  unitTaxProfiles: UnitTaxRow[];
  accountingMaps: AccountingMapRow[];
  cfdiInvoices: CfdiInvoiceRow[];
  units: UnitOption[];
  pendingSecondReviewCount?: number;
  onReload: () => void;
  onOpenPaymentsReview?: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [speiOpen, setSpeiOpen] = useState(false);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);

  const [dualEnabled, setDualEnabled] = useState(approvalSettings.payments_dual_enabled);
  const [dualThreshold, setDualThreshold] = useState(String(approvalSettings.payments_dual_threshold));

  const [legalName, setLegalName] = useState(fiscalProfile?.legal_name ?? '');
  const [rfc, setRfc] = useState(fiscalProfile?.rfc ?? '');
  const [taxRegime, setTaxRegime] = useState(fiscalProfile?.tax_regime ?? '601');
  const [postalCode, setPostalCode] = useState(fiscalProfile?.postal_code ?? '');
  const [defaultSeries, setDefaultSeries] = useState(fiscalProfile?.default_series ?? 'A');
  const [autoInvoice, setAutoInvoice] = useState(fiscalProfile?.auto_invoice_on_approve ?? false);
  const [pacOrgId, setPacOrgId] = useState(fiscalProfile?.pac_organization_id ?? '');

  const [taxUnitId, setTaxUnitId] = useState(units[0]?.id ?? '');
  const selectedUnitTax = useMemo(
    () => unitTaxProfiles.find((row) => row.unit_id === taxUnitId) ?? null,
    [taxUnitId, unitTaxProfiles],
  );
  const [unitLegalName, setUnitLegalName] = useState(selectedUnitTax?.legal_name ?? '');
  const [unitRfc, setUnitRfc] = useState(selectedUnitTax?.rfc ?? '');
  const [unitPostalCode, setUnitPostalCode] = useState(selectedUnitTax?.postal_code ?? '');
  const [unitCfdiUse, setUnitCfdiUse] = useState(selectedUnitTax?.cfdi_use ?? 'D10');
  const [unitEmail, setUnitEmail] = useState(selectedUnitTax?.email ?? '');
  const [unitTaxRegime, setUnitTaxRegime] = useState(selectedUnitTax?.tax_regime ?? '616');

  const [mapMovementType, setMapMovementType] = useState<'income' | 'expense'>('income');
  const [mapCategory, setMapCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [mapAccountCode, setMapAccountCode] = useState('');
  const [mapAccountName, setMapAccountName] = useState('');

  const cfdiEnabled = isCfdiBillingEnabled();

  function run(action: () => Promise<{ error?: string; success?: boolean }>, successMessage: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.error ?? successMessage);
      if (result.success) {
        setEditingMapId(null);
        onReload();
      }
    });
  }

  function startEditMap(row: AccountingMapRow) {
    setEditingMapId(row.id);
    setMapMovementType(row.movement_type);
    setMapCategory(row.veka_category);
    setMapAccountCode(row.account_code);
    setMapAccountName(row.account_name ?? '');
  }

  function resetMapForm() {
    setEditingMapId(null);
    setMapMovementType('income');
    setMapCategory(INCOME_CATEGORIES[0]);
    setMapAccountCode('');
    setMapAccountName('');
  }

  return (
    <div className="space-y-6">
      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Cumplimiento y controles</h2>
        <p className="mt-1 text-sm text-muted">
          Aquí configuras políticas de aprobación, mapeo contable y (cuando esté activo) facturación. No se
          registran ingresos ni egresos en esta pestaña.
        </p>
        <p className="mt-2 text-xs text-subtle">
          La póliza contable (CSV debe/haber) se descarga desde{' '}
          <span className="font-medium text-[var(--text)]">Ingresos y egresos</span> usando el mapeo de
          abajo.
        </p>
        {onOpenPaymentsReview ? (
          <div className="mt-4">
            <div className="glass-tab-strip inline-flex shrink-0" role="group">
              <button
                type="button"
                onClick={onOpenPaymentsReview}
                className="glass-tab glass-tab-active !min-w-0 !flex-none px-2.5 py-1.5 text-xs"
              >
                Ir a Ingresos y egresos · exportar póliza
              </button>
            </div>
          </div>
        ) : null}
      </GlassCard>

      <GlassCard>
        <SectionHeading help={HELP.cumplimiento.makerChecker}>Doble aprobación (maker-checker)</SectionHeading>
        <p className="mt-1 text-sm text-muted">
          Por defecto está activo. Para transferencias con comprobante, exige dos personas distintas cuando el
          monto supera el umbral. Los pagos en línea (tarjeta/Oxxo/SPEI) se aprueban automáticamente al
          confirmarse.
        </p>
        {pendingSecondReviewCount > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2">
            <span className="glass-tag-blue">
              {pendingSecondReviewCount} pago{pendingSecondReviewCount === 1 ? '' : 's'} en 2ª aprobación
            </span>
            {onOpenPaymentsReview ? (
              <button
                type="button"
                onClick={onOpenPaymentsReview}
                className="text-xs font-semibold text-[var(--text)] underline-offset-2 hover:underline"
              >
                Revisar en Ingresos y egresos
              </button>
            ) : null}
          </div>
        ) : null}
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={dualEnabled}
            onChange={(e) => setDualEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Requerir doble aprobación en pagos por transferencia</span>
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-subtle">Umbral (MXN)</span>
          <MoneyInput value={dualThreshold} onChange={setDualThreshold} className="w-40" />
        </label>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const formData = new FormData();
                formData.set('condominium_id', condominiumId);
                if (dualEnabled) formData.set('payments_dual_enabled', 'true');
                formData.set('payments_dual_threshold', dualThreshold);
                return saveApprovalSettings(formData);
              }, 'Política de aprobación guardada.')
            }
            className="glass-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Guardar política
          </button>
        </div>
      </GlassCard>

      {cfdiEnabled ? (
        <GlassCard>
          <SectionHeading help={HELP.cumplimiento.cfdiPausa}>CFDI / facturación MX</SectionHeading>
          <p className="mt-1 text-sm text-muted">
            Emisor del condominio vía Facturapi. Uso CFDI recomendado para cuotas:{' '}
            <strong>D10</strong>.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="glass-input"
              placeholder="Razón social emisor"
            />
            <input
              value={rfc}
              onChange={(e) => setRfc(e.target.value)}
              className="glass-input"
              placeholder="RFC emisor"
            />
            <input
              value={taxRegime}
              onChange={(e) => setTaxRegime(e.target.value)}
              className="glass-input"
              placeholder="Régimen fiscal (ej. 601)"
            />
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="glass-input"
              placeholder="C.P. emisor"
            />
            <input
              value={defaultSeries}
              onChange={(e) => setDefaultSeries(e.target.value)}
              className="glass-input"
              placeholder="Serie"
            />
            <input
              value={pacOrgId}
              onChange={(e) => setPacOrgId(e.target.value)}
              className="glass-input"
              placeholder="ID organización Facturapi (opcional)"
            />
          </div>
          <label className="mt-3 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={autoInvoice}
              onChange={(e) => setAutoInvoice(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Timbrar CFDI automáticamente al aprobar pagos</span>
          </label>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const formData = new FormData();
                  formData.set('condominium_id', condominiumId);
                  formData.set('legal_name', legalName);
                  formData.set('rfc', rfc);
                  formData.set('tax_regime', taxRegime);
                  formData.set('postal_code', postalCode);
                  formData.set('default_series', defaultSeries);
                  formData.set('pac_organization_id', pacOrgId);
                  if (autoInvoice) formData.set('auto_invoice_on_approve', 'true');
                  return saveFiscalProfile(formData);
                }, 'Perfil fiscal guardado.')
              }
              className="glass-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Guardar emisor
            </button>
          </div>

          <div className="mt-6 border-t border-white/10 pt-4">
            <h3 className="text-base font-semibold text-[var(--text)]">Receptor por unidad</h3>
            <select
              value={taxUnitId}
              onChange={(e) => {
                setTaxUnitId(e.target.value);
                const row = unitTaxProfiles.find((item) => item.unit_id === e.target.value);
                setUnitLegalName(row?.legal_name ?? '');
                setUnitRfc(row?.rfc ?? '');
                setUnitPostalCode(row?.postal_code ?? '');
                setUnitCfdiUse(row?.cfdi_use ?? 'D10');
                setUnitEmail(row?.email ?? '');
                setUnitTaxRegime(row?.tax_regime ?? '616');
              }}
              className="glass-input mt-3"
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id} className="bg-slate-900">
                  {unit.identifier}
                </option>
              ))}
            </select>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={unitLegalName}
                onChange={(e) => setUnitLegalName(e.target.value)}
                className="glass-input"
                placeholder="Nombre o razón social"
              />
              <input
                value={unitRfc}
                onChange={(e) => setUnitRfc(e.target.value)}
                className="glass-input"
                placeholder="RFC receptor"
              />
              <input
                value={unitPostalCode}
                onChange={(e) => setUnitPostalCode(e.target.value)}
                className="glass-input"
                placeholder="C.P."
              />
              <input
                value={unitCfdiUse}
                onChange={(e) => setUnitCfdiUse(e.target.value)}
                className="glass-input"
                placeholder="Uso CFDI"
              />
              <input
                value={unitEmail}
                onChange={(e) => setUnitEmail(e.target.value)}
                className="glass-input"
                placeholder="Correo fiscal"
              />
              <input
                value={unitTaxRegime}
                onChange={(e) => setUnitTaxRegime(e.target.value)}
                className="glass-input"
                placeholder="Régimen receptor"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={pending || !taxUnitId}
                onClick={() =>
                  run(async () => {
                    const formData = new FormData();
                    formData.set('unit_id', taxUnitId);
                    formData.set('legal_name', unitLegalName);
                    formData.set('rfc', unitRfc);
                    formData.set('postal_code', unitPostalCode);
                    formData.set('cfdi_use', unitCfdiUse);
                    formData.set('email', unitEmail);
                    formData.set('tax_regime', unitTaxRegime);
                    return saveUnitTaxProfile(formData);
                  }, 'Datos fiscales de unidad guardados.')
                }
                className="glass-btn px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Guardar receptor
              </button>
            </div>
          </div>

          {cfdiInvoices.length > 0 ? (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="text-base font-semibold text-[var(--text)]">CFDI recientes</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {cfdiInvoices.slice(0, 8).map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2"
                  >
                    <span>
                      {invoice.unit?.identifier ?? 'Unidad'} · {formatCurrency(Number(invoice.total))} ·{' '}
                      {invoice.status}
                    </span>
                    {invoice.pdf_url ? (
                      <a
                        href={invoice.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent hover:underline"
                      >
                        PDF
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </GlassCard>
      ) : (
        <GlassCard>
          <SectionHeading help={HELP.cumplimiento.cfdiPausa}>CFDI / facturación MX</SectionHeading>
          <p className="mt-2 text-sm text-muted">
            Facturación pausada hasta tener datos fiscales del condominio y de los residentes. La doble
            aprobación y el mapeo contable siguen disponibles.
          </p>
        </GlassCard>
      )}

      <GlassCard>
        <SectionHeading help={HELP.cumplimiento.export}>Mapeo a cuentas contables</SectionHeading>
        <p className="mt-1 text-sm text-muted">
          Relaciona categorías Veka con cuentas de tu catálogo. Luego exporta la póliza desde Ingresos y
          egresos.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => seedDefaultAccountingMaps(condominiumId), 'Catálogo contable base cargado.')}
            className="glass-btn px-3 py-1.5 text-xs font-semibold"
          >
            Cargar catálogo sugerido
          </button>
          {onOpenPaymentsReview ? (
            <button
              type="button"
              onClick={onOpenPaymentsReview}
              className="glass-btn px-3 py-1.5 text-xs font-semibold"
            >
              Exportar póliza
            </button>
          ) : null}
          {editingMapId ? (
            <button type="button" onClick={resetMapForm} className="glass-btn px-3 py-1.5 text-xs font-semibold">
              Cancelar edición
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <select
            value={mapMovementType}
            onChange={(e) => {
              const next = e.target.value as 'income' | 'expense';
              setMapMovementType(next);
              setMapCategory(next === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
            }}
            className="glass-input"
          >
            <option value="income" className="bg-slate-900">
              Ingreso
            </option>
            <option value="expense" className="bg-slate-900">
              Egreso
            </option>
          </select>
          <select
            value={mapCategory}
            onChange={(e) => setMapCategory(e.target.value)}
            className="glass-input"
          >
            {(mapMovementType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((category) => (
              <option key={category} value={category} className="bg-slate-900">
                {mapMovementType === 'income' ? incomeCategoryLabel(category) : expenseCategoryLabel(category)}
              </option>
            ))}
          </select>
          <input
            value={mapAccountCode}
            onChange={(e) => setMapAccountCode(e.target.value)}
            className="glass-input"
            placeholder="Cuenta"
          />
          <input
            value={mapAccountName}
            onChange={(e) => setMapAccountName(e.target.value)}
            className="glass-input"
            placeholder="Nombre cuenta"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const formData = new FormData();
                formData.set('movement_type', mapMovementType);
                formData.set('veka_category', mapCategory);
                formData.set('account_code', mapAccountCode);
                formData.set('account_name', mapAccountName);
                if (editingMapId) {
                  formData.set('map_id', editingMapId);
                  return updateAccountingCategoryMap(formData);
                }
                formData.set('condominium_id', condominiumId);
                return saveAccountingCategoryMap(formData);
              }, editingMapId ? 'Mapeo actualizado.' : 'Mapeo contable guardado.')
            }
            className="glass-btn px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {editingMapId ? 'Guardar cambios' : 'Agregar mapeo'}
          </button>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {accountingMaps.length === 0 ? (
            <li className="text-subtle">
              Sin mapeos. Usa <span className="font-medium text-[var(--text)]">Cargar catálogo sugerido</span>{' '}
              o agrega cuentas manualmente para poder exportar la póliza.
            </li>
          ) : (
            accountingMaps.map((row) => (
              <li
                key={row.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                  editingMapId === row.id ? 'bg-white/5' : ''
                }`}
              >
                <span className="text-muted">
                  {row.movement_type === 'income' ? 'Ingreso' : 'Egreso'} ·{' '}
                  {row.movement_type === 'income'
                    ? incomeCategoryLabel(row.veka_category)
                    : expenseCategoryLabel(row.veka_category)}{' '}
                  → {row.account_code} {row.account_name ? `(${row.account_name})` : ''}
                </span>
                <div className="glass-tab-strip inline-flex shrink-0" role="group" aria-label="Acciones mapeo">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startEditMap(row)}
                    className="glass-tab !min-w-0 !flex-none px-2.5 py-1.5 text-xs disabled:opacity-60"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm('¿Eliminar este mapeo contable?')) return;
                      run(() => deleteAccountingCategoryMap(row.id), 'Mapeo eliminado.');
                    }}
                    className="glass-tab !min-w-0 !flex-none px-2.5 py-1.5 text-xs disabled:opacity-60"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </GlassCard>

      <GlassCard>
        <button
          type="button"
          onClick={() => setSpeiOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <SectionHeading help={HELP.cumplimiento.speiOxxo}>Pagos Oxxo / SPEI (referencia)</SectionHeading>
          <span className="text-subtle" aria-hidden>
            {speiOpen ? '▾' : '▸'}
          </span>
        </button>
        {speiOpen ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Los residentes pueden elegir tarjeta, Oxxo o SPEI al pagar en línea. Oxxo y SPEI generan una
              referencia y quedan en estado <em>Esperando pago</em> hasta que Stripe confirme el abono. Esto se
              configura en Stripe, no en Veka.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-subtle">
              <li>Activa Oxxo y transferencias SPEI en tu cuenta Stripe (México).</li>
              <li>
                Configura el webhook con eventos async:{' '}
                <code className="text-xs">checkout.session.async_payment_succeeded</code>.
              </li>
              <li>El residente ve la referencia al abrir la pasarela de Stripe.</li>
            </ul>
          </>
        ) : (
          <p className="mt-1 text-xs text-subtle">Instrucciones técnicas de Stripe · expandir para ver.</p>
        )}
      </GlassCard>

      {message ? (
        <p
          className={`text-sm ${
            message.includes('error') || message.includes('No') || message.includes('Completa')
              ? 'text-red-300'
              : 'text-emerald-300'
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
