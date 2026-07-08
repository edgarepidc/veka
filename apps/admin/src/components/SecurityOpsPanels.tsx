'use client';

import { formatVisitVehicle } from '@veka/shared';
import { useState, useTransition } from 'react';

import { checkOutVisit, deliverPackage } from '@/app/(panel)/seguridad/actions';
import { GlassCard } from '@/components/ui/GlassCard';
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

function visitStatus(visit: VisitRow): string {
  if (visit.checked_out_at) return 'Salida registrada';
  if (visit.checked_in_at) return 'Dentro del condominio';
  return 'Pendiente de ingreso';
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

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Visitas de hoy</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Pases vigentes para el día. Registra salida cuando el visitante se retire.
        </p>
        <div className="mt-4 space-y-3">
          {visits.length === 0 ? (
            <p className="text-sm text-subtle">No hay visitas programadas para hoy.</p>
          ) : (
            visits.map((visit) => (
              <div
                key={visit.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-3"
              >
                <div>
                  <p className="font-medium text-[var(--text)]">{visit.visitor_name}</p>
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
                  <p className="mt-1 text-xs font-semibold text-accent">{visitStatus(visit)}</p>
                </div>
                {visit.checked_in_at && !visit.checked_out_at ? (
                  <form action={(formData) => run(checkOutVisit, formData, 'Salida registrada.')}>
                    <input type="hidden" name="visit_id" value={visit.id} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                    >
                      Registrar salida
                    </button>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Paquetes en caseta</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Pendientes de entrega al residente.
        </p>
        <div className="mt-4 space-y-3">
          {packages.length === 0 ? (
            <p className="text-sm text-subtle">No hay paquetes pendientes.</p>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-3"
              >
                <p className="font-medium text-[var(--text)]">
                  {pkg.carrier ?? 'Paquete'} · Unidad {pkg.unit?.identifier ?? '—'}
                </p>
                {pkg.tracking_number ? (
                  <p className="mt-1 text-sm text-muted">Guía {pkg.tracking_number}</p>
                ) : null}
                <p className="mt-1 text-xs text-subtle">Recibido {formatTime(pkg.received_at)}</p>
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  action={(formData) => run(deliverPackage, formData, 'Entrega registrada.')}
                >
                  <input type="hidden" name="package_id" value={pkg.id} />
                  <label className="grid gap-1 text-sm">
                    <span className="text-subtle">Entregado a (opcional)</span>
                    <input
                      name="delivered_to"
                      placeholder="Nombre de quien recoge"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Marcar entregado
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}
