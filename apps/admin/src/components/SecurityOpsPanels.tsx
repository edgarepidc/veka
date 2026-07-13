'use client';

import {
  STORAGE_BUCKETS,
  formatVisitVehicle,
  amenityScopeLabel,
  packageAccentTone,
  packageStatusLabel,
  packageTagTone,
  resolveStorageImageUrl,
  visitAccentTone,
  visitStatusLabel,
  visitTagTone,
} from '@veka/shared';
import { useState, useTransition } from 'react';

import { checkOutVisit, deliverPackage } from '@/app/(panel)/seguridad/actions';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusTag } from '@/components/ui/StatusTag';
import type { PackageRow, VisitRow } from '@/lib/load-seguridad';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

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
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  function run(
    action: (formData: FormData) => Promise<{ error?: string; ok?: boolean }>,
    formData: FormData,
    ok: string,
  ) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? ok);
      if (!result.error) setDeliveringId(null);
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          className={`text-sm ${
            message.includes('Error') || message.includes('inválid') ? 'text-red-300' : 'text-accent'
          }`}
        >
          {message}
        </p>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Visitas de hoy</h2>
        <p className="mt-1 text-sm text-muted">
          Pases vigentes en la zona horaria del condominio. Registra salida cuando el visitante se retire.
        </p>
        <div className="mt-4 space-y-3">
          {visits.length === 0 ? (
            <GlassCard variant="muted">
              <p className="text-sm text-subtle">No hay visitas en este alcance para hoy.</p>
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
                    <span className="glass-tag-gray px-1.5 py-0.5 text-[10px]">
                      {amenityScopeLabel(
                        visit.unit?.cluster_id ?? null,
                        visit.unit?.cluster?.name ?? null,
                        'Todo',
                      )}
                    </span>
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
                  {visit.notes ? <p className="mt-1 text-xs text-muted">{visit.notes}</p> : null}
                </div>
                {visit.checked_in_at && !visit.checked_out_at ? (
                  <form action={(formData) => run(checkOutVisit, formData, 'Salida registrada.')}>
                    <input type="hidden" name="visit_id" value={visit.id} />
                    <button type="submit" disabled={pending} className="glass-btn-secondary px-3 py-1.5 text-sm">
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
        <p className="mt-1 text-sm text-muted">Pendientes de entrega al residente. Indica quién lo recogió.</p>
        <div className="mt-4 space-y-3">
          {packages.length === 0 ? (
            <GlassCard variant="muted">
              <p className="text-sm text-subtle">Sin paquetes pendientes en este alcance.</p>
            </GlassCard>
          ) : (
            packages.map((pkg) => {
              const photoUrl = resolveStorageImageUrl(
                SUPABASE_URL,
                pkg.photo_url,
                STORAGE_BUCKETS.PACKAGES,
              );
              return (
                <GlassCard key={pkg.id} variant="accent" accent={packageAccentTone(pkg.status)} className="!p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[var(--text)]">
                          {pkg.carrier ?? 'Paquete'} · Unidad {pkg.unit?.identifier ?? '—'}
                        </p>
                        <StatusTag label={packageStatusLabel(pkg.status)} tone={packageTagTone(pkg.status)} />
                        <span className="glass-tag-gray px-1.5 py-0.5 text-[10px]">
                          {amenityScopeLabel(
                            pkg.unit?.cluster_id ?? null,
                            pkg.unit?.cluster?.name ?? null,
                            'Todo',
                          )}
                        </span>
                      </div>
                      {pkg.tracking_number ? (
                        <p className="mt-1 text-xs text-subtle">Guía {pkg.tracking_number}</p>
                      ) : null}
                      {pkg.notes ? <p className="mt-1 text-xs text-muted">{pkg.notes}</p> : null}
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoUrl}
                          alt=""
                          className="mt-2 h-20 w-28 rounded-lg border border-[var(--border)] object-cover"
                        />
                      ) : null}
                    </div>

                    {pkg.status === 'received' ? (
                      deliveringId === pkg.id ? (
                        <form
                          action={(formData) => run(deliverPackage, formData, 'Paquete entregado.')}
                          className="flex min-w-[220px] flex-col gap-2"
                        >
                          <input type="hidden" name="package_id" value={pkg.id} />
                          <input
                            name="delivered_to"
                            required
                            placeholder="Quién recogió"
                            className="glass-input text-sm"
                          />
                          <div className="flex gap-2">
                            <button type="submit" disabled={pending} className="glass-btn-primary px-3 py-1.5 text-sm">
                              Confirmar
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setDeliveringId(null)}
                              className="glass-btn-secondary px-3 py-1.5 text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setDeliveringId(pkg.id)}
                          className="glass-btn-primary px-3 py-1.5 text-sm"
                        >
                          Marcar entregado
                        </button>
                      )
                    ) : null}
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
