'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  amenityImagePath,
  amenityScopeLabel,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_MIN_BOOKING_LEAD_HOURS,
  DEFAULT_MIN_CANCEL_LEAD_HOURS,
  formatBlockedDatesForInput,
  MAX_BOOKING_HORIZON_DAYS,
  MAX_LEAD_HOURS,
  MIN_BOOKING_HORIZON_DAYS,
  resolveStorageImageUrl,
  STORAGE_BUCKETS,
} from '@veka/shared';

import {
  approveReservation,
  cancelReservation,
  rejectReservation,
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
  booking_horizon_days: DEFAULT_BOOKING_HORIZON_DAYS,
  min_booking_lead_hours: DEFAULT_MIN_BOOKING_LEAD_HOURS,
  min_cancel_lead_hours: DEFAULT_MIN_CANCEL_LEAD_HOURS,
  max_active_reservations: 1,
  blocked_dates: [],
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

function RulesSummaryChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'green' | 'amber';
}) {
  const tones = {
    neutral: 'border-white/15 bg-white/5 text-subtle',
    green: 'border-emerald-400/25 bg-emerald-400/15 text-emerald-200',
    amber: 'border-amber-400/35 bg-amber-400/15 text-amber-100',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      <span className="opacity-80">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-subtle">
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
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
  const [reservationScopeFilter, setReservationScopeFilter] = useState<'all' | 'general' | string>('all');
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

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

  const filteredReservations = useMemo(() => {
    if (reservationScopeFilter === 'all') return reservations;
    if (reservationScopeFilter === 'general') {
      return reservations.filter((reservation) => !reservation.amenity?.cluster_id);
    }
    return reservations.filter(
      (reservation) => reservation.amenity?.cluster_id === reservationScopeFilter,
    );
  }, [reservations, reservationScopeFilter]);

  const blockIfOverdue = Boolean(spacesSettings.block_reservations_if_overdue);
  const notifyReservationUpdates = spacesSettings.notify_reservation_updates !== false;
  const rulesFormKey = [blockIfOverdue, notifyReservationUpdates].join('|');

  function run(
    action: (formData: FormData) => Promise<{ error?: string; success?: boolean; ok?: boolean }>,
    formData: FormData,
    ok: string,
    onSuccess?: () => void,
  ) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? ok);
      if (!result.error) {
        onSuccess?.();
        if (ok.includes('guardad')) {
          setEditing(null);
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      <GlassCard className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setRulesExpanded((open) => !open)}
          className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-white/5"
          aria-expanded={rulesExpanded}
        >
          <Chevron open={rulesExpanded} />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--text)]">Reglas generales</h2>
            <p className="mt-1 text-sm text-muted">
              Políticas del condominio que aplican a todas las amenidades. Las reglas de reserva se
              configuran en cada espacio.
            </p>
            {!rulesExpanded ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <RulesSummaryChip
                  label="Bloqueo por mora"
                  value={blockIfOverdue ? 'Activo' : 'Inactivo'}
                  tone={blockIfOverdue ? 'amber' : 'neutral'}
                />
                <RulesSummaryChip
                  label="Notificaciones"
                  value={notifyReservationUpdates ? 'Activas' : 'Inactivas'}
                  tone={notifyReservationUpdates ? 'green' : 'neutral'}
                />
              </div>
            ) : null}
          </div>
        </button>

        {rulesExpanded ? (
          <div className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4">
            <p className="text-sm text-muted">
              Activa el bloqueo por adeudos (cada amenidad puede marcarse con restricción por mora) y
              las notificaciones al residente.
            </p>
            <form
              key={rulesFormKey}
              className="grid gap-4"
              action={(formData) =>
                run(updateSpacesSettings, formData, 'Reglas guardadas.', () => {
                  setRulesExpanded(false);
                  router.refresh();
                })
              }
            >
              <input type="hidden" name="condominium_id" value={condominiumId} />
              <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  name="block_reservations_if_overdue"
                  defaultChecked={blockIfOverdue}
                />
                Bloquear reservas si la unidad tiene adeudos
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  name="notify_reservation_updates"
                  defaultChecked={notifyReservationUpdates}
                />
                Notificar al residente cuando se aprueba o cancela su reserva
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Guardar reglas
                </button>
                <button
                  type="button"
                  onClick={() => setRulesExpanded(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
                >
                  Cerrar
                </button>
              </div>
            </form>
          </div>
        ) : null}
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
                setEditing({
                  ...EMPTY_AMENITY,
                  id: '',
                  created_at: new Date().toISOString(),
                  cluster: null,
                })
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
                  <span className="text-xs text-subtle">
                    Personas o unidades que pueden reservar el mismo horario (capacidad del espacio).
                  </span>
                </label>

                <p className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
                  Reglas de reserva de este espacio
                </p>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Anticipación (días)</span>
                  <input
                    type="number"
                    name="booking_horizon_days"
                    min={MIN_BOOKING_HORIZON_DAYS}
                    max={MAX_BOOKING_HORIZON_DAYS}
                    defaultValue={draft.booking_horizon_days}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Anticipación mínima (horas)</span>
                  <input
                    type="number"
                    name="min_booking_lead_hours"
                    min={0}
                    max={MAX_LEAD_HOURS}
                    defaultValue={draft.min_booking_lead_hours}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Plazo para cancelar (horas)</span>
                  <input
                    type="number"
                    name="min_cancel_lead_hours"
                    min={0}
                    max={MAX_LEAD_HOURS}
                    defaultValue={draft.min_cancel_lead_hours}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-[var(--text)]">Máx. reservas activas por unidad</span>
                  <input
                    type="number"
                    name="max_active_reservations"
                    min={0}
                    defaultValue={draft.max_active_reservations}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                  <span className="text-xs text-subtle">
                    Cuántas reservas futuras puede tener una unidad en este espacio (0 = sin límite).
                  </span>
                </label>

                <label className="grid gap-1 text-sm sm:col-span-2">
                  <span className="font-medium text-[var(--text)]">Días bloqueados (YYYY-MM-DD)</span>
                  <textarea
                    name="blocked_dates"
                    rows={3}
                    defaultValue={formatBlockedDatesForInput(draft.blocked_dates)}
                    placeholder={'2026-12-25\n2026-01-01'}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs"
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
                      <p className="mt-1 text-xs text-subtle">
                        Anticipación {amenity.booking_horizon_days} d · activas/unidad{' '}
                        {amenity.max_active_reservations > 0 ? amenity.max_active_reservations : '∞'}
                        {amenity.blocked_dates.length > 0
                          ? ` · ${amenity.blocked_dates.length} día(s) bloqueado(s)`
                          : ''}
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
          <div className="flex flex-wrap gap-2">
            {scopeOptions.map((option) => (
              <button
                key={`reservation-${option.id}`}
                type="button"
                onClick={() => setReservationScopeFilter(option.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  reservationScopeFilter === option.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'border-[var(--border)] text-muted'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {filteredReservations.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-subtle">No hay reservas próximas en esta vista.</p>
            </GlassCard>
          ) : (
            filteredReservations.map((reservation) => {
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
                        {amenityScopeLabel(
                          reservation.amenity?.cluster_id,
                          reservation.amenity?.cluster?.name,
                        )}{' '}
                        · Hasta {formatDateTime(reservation.ends_at)} ·{' '}
                        {reservationStatusLabel(reservation.status)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reservation.status === 'pending' ? (
                      <>
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
                        <form
                          action={(formData) => run(rejectReservation, formData, 'Solicitud rechazada.')}
                          onSubmit={(event) => {
                            if (
                              !window.confirm(
                                `¿Rechazar la solicitud de ${amenityLabel} (unidad ${reservation.unit?.identifier ?? '—'})?`,
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
                            Rechazar
                          </button>
                        </form>
                      </>
                    ) : null}
                    {reservation.status === 'confirmed' ? (
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
