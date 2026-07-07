'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  amenityImagePath,
  amenityScopeLabel,
  resolveStorageImageUrl,
  STORAGE_BUCKETS,
} from '@veka/shared';

import {
  approveReservation,
  cancelReservation,
  toggleAmenityActive,
  updateSpacesSettings,
  upsertAmenity,
} from '@/app/(panel)/espacios/actions';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import type { AmenityRow, ClusterOption, ReservationRow } from '@/lib/load-espacios';
import type { SpacesSettings } from '@veka/shared';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

type Tab = 'amenidades' | 'reservas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'amenidades', label: 'Amenidades' },
  { id: 'reservas', label: 'Reservas' },
];

const EMPTY_AMENITY: Omit<AmenityRow, 'id' | 'created_at' | 'cluster'> = {
  name: '',
  description: '',
  cluster_id: null,
  image_url: null,
  max_daily_reservations: 1,
  max_monthly_reservations: 4,
  max_concurrent_reservations: 1,
  slot_duration_minutes: 60,
  open_time: '08:00',
  close_time: '22:00',
  requires_approval: false,
  restrict_if_overdue: false,
  is_active: true,
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function trimTime(value: string): string {
  return value.slice(0, 5);
}

function reservationStatusLabel(status: ReservationRow['status']): string {
  if (status === 'confirmed') return 'Confirmada';
  if (status === 'pending') return 'Pendiente de aprobación';
  if (status === 'cancelled') return 'Cancelada';
  return 'Completada';
}

export function SpacesManager({
  amenities,
  reservations,
  clusters,
  spacesSettings,
  condominiumId,
}: {
  amenities: AmenityRow[];
  reservations: ReservationRow[];
  clusters: ClusterOption[];
  spacesSettings: SpacesSettings;
  condominiumId: string;
}) {
  const [tab, setTab] = useState<Tab>('amenidades');
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<AmenityRow | null>(null);
  const [draftId] = useState(() => crypto.randomUUID());
  const [scopeFilter, setScopeFilter] = useState<'all' | 'general' | string>('all');
  const [pending, start] = useTransition();

  const draft = editing ?? ({ ...EMPTY_AMENITY, id: '', created_at: '', cluster: null } as AmenityRow);
  const isNew = !editing?.id;
  const imageAmenityId = editing?.id || draftId;

  const scopeOptions = useMemo(() => {
    const options: { id: 'all' | 'general' | string; label: string }[] = [
      { id: 'all', label: 'Todas' },
      { id: 'general', label: 'Fraccionamiento' },
      ...clusters.map((cluster) => ({ id: cluster.id, label: cluster.name })),
    ];
    return options;
  }, [clusters]);

  const filteredAmenities = useMemo(() => {
    if (scopeFilter === 'all') return amenities;
    if (scopeFilter === 'general') return amenities.filter((amenity) => !amenity.cluster_id);
    return amenities.filter((amenity) => amenity.cluster_id === scopeFilter);
  }, [amenities, scopeFilter]);

  function run(
    action: (formData: FormData) => Promise<{ error?: string; success?: boolean; ok?: boolean }>,
    formData: FormData,
    ok: string,
  ) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? ok);
      if (!result.error && ok.includes('guardad')) {
        setEditing(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Reglas generales</h2>
        <p className="mt-1 text-sm text-muted">
          Controla si los residentes con adeudos pueden reservar espacios marcados con restricción por mora.
        </p>
        <form
          className="mt-4 flex flex-wrap items-center gap-4"
          action={(formData) => run(updateSpacesSettings, formData, 'Reglas guardadas.')}
        >
          <input type="hidden" name="condominium_id" value={condominiumId} />
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              name="block_reservations_if_overdue"
              defaultChecked={Boolean(spacesSettings.block_reservations_if_overdue)}
            />
            Bloquear reservas si la unidad tiene adeudos
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Guardar reglas
          </button>
        </form>
      </GlassCard>

      <div className="glass-tab-strip">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`glass-tab ${tab === item.id ? 'glass-tab-active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? (
        <p
          className={`text-sm ${message.includes('Error') || message.includes('obligat') || message.includes('inválid') ? 'text-red-300' : 'text-accent'}`}
        >
          {message}
        </p>
      ) : null}

      {tab === 'amenidades' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setScopeFilter(option.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    scopeFilter === option.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                      : 'border-[var(--border)] text-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setEditing({ ...EMPTY_AMENITY, id: '', created_at: new Date().toISOString(), cluster: null })
              }
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Nueva amenidad
            </button>
          </div>

          {editing ? (
            <GlassCard>
              <h3 className="text-lg font-semibold text-[var(--text)]">
                {isNew ? 'Nueva amenidad' : `Editar ${editing.name}`}
              </h3>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-2"
                action={(formData) => {
                  if (isNew) formData.set('amenity_id', imageAmenityId);
                  run(upsertAmenity, formData, 'Amenidad guardada.');
                }}
              >
                <input type="hidden" name="condominium_id" value={condominiumId} />
                {!isNew ? <input type="hidden" name="amenity_id" value={editing.id} /> : null}

                <label className="grid gap-1 text-sm sm:col-span-2">
                  <span className="font-medium text-[var(--text)]">Nombre</span>
                  <input
                    name="name"
                    required
                    defaultValue={draft.name}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm sm:col-span-2">
                  <span className="font-medium text-[var(--text)]">Ámbito</span>
                  <select
                    name="cluster_id"
                    defaultValue={draft.cluster_id ?? ''}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <option value="">Todo el fraccionamiento</option>
                    {clusters.map((cluster) => (
                      <option key={cluster.id} value={cluster.id}>
                        {cluster.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="sm:col-span-2">
                  <ImageUpload
                    bucket={STORAGE_BUCKETS.AMENITY_IMAGES}
                    buildPath={(ext) => amenityImagePath(condominiumId, imageAmenityId, ext)}
                    currentPath={draft.image_url}
                    inputName="image_url"
                    label="Imagen del espacio"
                    hint="JPG o PNG, máximo 2 MB. Se muestra en la app móvil."
                    previewClassName="h-28 w-full max-w-xs rounded-xl object-cover"
                  />
                </div>

                <label className="grid gap-1 text-sm sm:col-span-2">
                  <span className="font-medium text-[var(--text)]">Descripción</span>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={draft.description ?? ''}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Apertura</span>
                  <input
                    type="time"
                    name="open_time"
                    required
                    defaultValue={trimTime(draft.open_time)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Cierre</span>
                  <input
                    type="time"
                    name="close_time"
                    required
                    defaultValue={trimTime(draft.close_time)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Duración del turno (min)</span>
                  <input
                    type="number"
                    name="slot_duration_minutes"
                    min={15}
                    step={15}
                    defaultValue={draft.slot_duration_minutes}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Cupo simultáneo por horario</span>
                  <input
                    type="number"
                    name="max_concurrent_reservations"
                    min={1}
                    defaultValue={draft.max_concurrent_reservations}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Máx. reservas por día (por residente)</span>
                  <input
                    type="number"
                    name="max_daily_reservations"
                    min={1}
                    defaultValue={draft.max_daily_reservations}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Máx. reservas por mes (por residente)</span>
                  <input
                    type="number"
                    name="max_monthly_reservations"
                    min={1}
                    defaultValue={draft.max_monthly_reservations}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="is_active" defaultChecked={draft.is_active} />
                  <span className="text-[var(--text)]">Visible y reservable en la app</span>
                </label>

                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="requires_approval" defaultChecked={draft.requires_approval} />
                  <span className="text-[var(--text)]">Requiere aprobación de administración</span>
                </label>

                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="restrict_if_overdue" defaultChecked={draft.restrict_if_overdue} />
                  <span className="text-[var(--text)]">Restringir si la unidad tiene adeudos (cuando la regla general está activa)</span>
                </label>

                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </GlassCard>
          ) : null}

          {filteredAmenities.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-subtle">No hay amenidades en esta vista.</p>
            </GlassCard>
          ) : (
            filteredAmenities.map((amenity) => {
              const imageUrl = resolveStorageImageUrl(
                SUPABASE_URL,
                amenity.image_url,
                STORAGE_BUCKETS.AMENITY_IMAGES,
              );

              return (
                <GlassCard key={amenity.id} className="space-y-3">
                  <div className="flex flex-wrap items-start gap-4">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" className="h-28 w-40 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-28 w-40 shrink-0 items-center justify-center rounded-xl bg-white/5 text-3xl">
                        🏢
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--text)]">{amenity.name}</p>
                      <p className="mt-1 text-xs text-subtle">
                        {amenityScopeLabel(amenity.cluster_id, amenity.cluster?.name)}
                      </p>
                      {amenity.description ? (
                        <p className="mt-1 text-sm text-muted">{amenity.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-subtle">
                        {trimTime(amenity.open_time)} – {trimTime(amenity.close_time)} · Turnos de{' '}
                        {amenity.slot_duration_minutes} min · cupo {amenity.max_concurrent_reservations}/horario ·{' '}
                        {amenity.max_daily_reservations}/día · {amenity.max_monthly_reservations}/mes
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {amenity.requires_approval ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">Aprobación</span>
                        ) : null}
                        {amenity.restrict_if_overdue ? (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-200">Restringe morosos</span>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        amenity.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-subtle'
                      }`}
                    >
                      {amenity.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(amenity)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                    >
                      Editar
                    </button>
                    <form
                      action={(formData) =>
                        run(
                          toggleAmenityActive,
                          formData,
                          amenity.is_active ? 'Amenidad desactivada.' : 'Amenidad activada.',
                        )
                      }
                    >
                      <input type="hidden" name="amenity_id" value={amenity.id} />
                      <input type="hidden" name="is_active" value={amenity.is_active ? 'false' : 'true'} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                      >
                        {amenity.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Aprueba solicitudes pendientes o cancela reservas confirmadas cuando sea necesario.
          </p>
          {reservations.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-subtle">No hay reservas próximas.</p>
            </GlassCard>
          ) : (
            reservations.map((reservation) => {
              const imageUrl = resolveStorageImageUrl(
                SUPABASE_URL,
                reservation.amenity?.image_url,
                STORAGE_BUCKETS.AMENITY_IMAGES,
              );
              const amenityLabel = reservation.amenity?.name ?? 'Amenidad';

              return (
                <GlassCard key={reservation.id} className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" className="h-24 w-36 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-xl bg-white/5 text-3xl">
                        🏢
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">{amenityLabel}</p>
                      <p className="mt-1 text-sm text-muted">
                        Unidad {reservation.unit?.identifier ?? '—'} · {formatDateTime(reservation.starts_at)}
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        Hasta {formatDateTime(reservation.ends_at)} · {reservationStatusLabel(reservation.status)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reservation.status === 'pending' ? (
                      <form action={(formData) => run(approveReservation, formData, 'Reserva aprobada.')}>
                        <input type="hidden" name="reservation_id" value={reservation.id} />
                        <button
                          type="submit"
                          disabled={pending}
                          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          Aprobar
                        </button>
                      </form>
                    ) : null}
                    {reservation.status === 'confirmed' || reservation.status === 'pending' ? (
                      <form
                        action={(formData) => run(cancelReservation, formData, 'Reserva cancelada.')}
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              `¿Cancelar la reserva de ${amenityLabel} (unidad ${reservation.unit?.identifier ?? '—'})? Esta acción no se puede deshacer.`,
                            )
                          ) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="reservation_id" value={reservation.id} />
                        <button
                          type="submit"
                          disabled={pending}
                          className="rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-200"
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
