'use client';

import {
  formatVisitVehicle,
  packageAccentTone,
  packageStatusLabel,
  packageTagTone,
  visitAccentTone,
  visitStatusLabel,
  visitTagTone,
} from '@veka/shared';
import { useState, useTransition } from 'react';

import { checkOutVisit, deliverPackage } from '@/app/(panel)/seguridad/actions';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusTag } from '@/components/ui/StatusTag';
import type { PackageRow, VisitRow } from '@/lib/load-seguridad';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function visitTypeLabel(type: VisitRow['visit_type']): string {
  if (type === 'service') return 'Servicio';
  if (type === 'rental') return 'Renta';
  return 'Visita';
}

export function SecurityOpsPanels({
  visits,
  packages,
}: {
  visits: VisitRow[];
  packages: PackageRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(
    action: (formData: FormData) => Promise<{ error?: string; ok?: boolean }>,
    formData: FormData,
    ok: string,
  ) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? ok);
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className={`text-sm ${message.includes('Error') || message.includes('inválid') ? 'text-red-300' : 'text-accent'}`}>
          {message}
        </p>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Visitas de hoy</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Pases vigentes para el día. Registra salida cuando el visitante se retire.
        </p>
        <div className="mt-4 space-y-3">
          {visits.length === 0 ? (
            <GlassCard variant="muted">
              <p className="text-sm text-subtle">No hay visitas programadas para hoy.</p>
            </GlassCard>
          ) : (
            visits.map((visit) => (
              <GlassCard
                key={visit.id}
                variant="accent"
                accent={visitAccentTone(visit)}
                className="flex flex-wrap items-start justify-between gap-3 !p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--text)]">{visit.visitor_name}</p>
                    <StatusTag
                      label={visitStatusLabel(visit, { activeLabel: 'Pendiente' })}
                      tone={visitTagTone(visit)}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Unidad {visit.unit?.identifier ?? '—'} · {visitTypeLabel(visit.visit_type)}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    Válido {formatTime(visit.valid_from)} – {formatTime(visit.valid_until)}
                    {visit.visit_type === 'rental' && visit.stay_days
                      ? ` · ${visit.stay_days} día(s)`
                      : ''}
                  </p>
                  {formatVisitVehicle(visit.vehicle_plate, visit.vehicle_model) ? (
                    <p className="mt-1 text-xs text-muted">
                      Vehículo: {formatVisitVehicle(visit.vehicle_plate, visit.vehicle_model)}
                    </p>
                  ) : null}
                  {visit.notes ? (
                    <p className="mt-1 text-xs text-muted">{visit.notes}</p>
                  ) : null}
                </div>
                {visit.checked_in_at && !visit.checked_out_at ? (
                  <form action={(formData) => run(checkOutVisit, formData, 'Salida registrada.')}>
                    <input type="hidden" name="visit_id" value={visit.id} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="glass-btn-secondary px-3 py-1.5 text-sm"
                    >
                      Registrar salida
                    </button>
                  </form>
                ) : null}
              </GlassCard>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Paquetes en caseta</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Pendientes de entrega al residente.
        </p>
        <div className="mt-4 space-y-3">
          {packages.length === 0 ? (
            <GlassCard variant="muted">
              <p className="text-sm text-subtle">Sin paquetes pendientes.</p>
            </GlassCard>
          ) : (
            packages.map((pkg) => (
              <GlassCard
                key={pkg.id}
                variant="accent"
                accent={packageAccentTone(pkg.status)}
                className="!p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[var(--text)]">
                        {pkg.carrier ?? 'Paquete'} · Unidad {pkg.unit?.identifier ?? '—'}
                      </p>
                      <StatusTag label={packageStatusLabel(pkg.status)} tone={packageTagTone(pkg.status)} />
                    </div>
                    {pkg.tracking_number ? (
                      <p className="mt-1 text-xs text-subtle">Guía {pkg.tracking_number}</p>
                    ) : null}
                  </div>
                  {pkg.status === 'received' ? (
                    <form action={(formData) => run(deliverPackage, formData, 'Paquete entregado.')}>
                      <input type="hidden" name="package_id" value={pkg.id} />
                      <button type="submit" disabled={pending} className="glass-btn-primary px-3 py-1.5 text-sm">
                        Marcar entregado
                      </button>
                    </form>
                  ) : null}
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
