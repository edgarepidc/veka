'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  MAINTENANCE_PERIOD_LABELS,
  MAINTENANCE_RECURRENCES,
  MAINTENANCE_TICKET_STATUSES,
  RECURRENCE_LABELS,
  STORAGE_BUCKETS,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  amenityScopeLabel,
  groupEvidenceByDate,
  groupRoutinesByWeekday,
  isImageStoragePath,
  maintenanceFilePath,
  matchesClusterResourceScope,
  recurrenceLabel,
  resolveStorageImageUrl,
  ticketCategoryLabel,
  ticketStatusLabel,
  ticketAccentTone,
  ticketTagTone,
  routineCardVariant,
  type MaintenancePeriodFilter,
  type MaintenanceRecurrence,
  type MaintenanceTicketStatus,
} from '@veka/shared';

import { FinanceScopeFilter } from '@/components/FinanceScopeFilter';
import { MultiImageUpload } from '@/components/MultiImageUpload';
import { FileUpload } from '@/components/ui/FileUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusTag } from '@/components/ui/StatusTag';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { createClient } from '@/lib/supabase/client';
import { HELP } from '@/lib/help-content';
import type {
  AmenityOption,
  ClusterOption,
  MaintenanceRoutineEvidenceRow,
  MaintenanceRoutineRow,
  MaintenanceTicketRow,
} from '@/lib/load-maintenance';

import {
  addTicketAttachment,
  createMaintenanceRoutine,
  createMaintenanceRoutineEvidence,
  deleteMaintenanceRoutine,
  deleteTicketAttachment,
  updateTicketStatus,
} from './actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

type Tab = 'tickets' | 'mensual';

const TABS: { id: Tab; label: string }[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'mensual', label: 'Mantenimiento mensual' },
];

const KANBAN_COLUMNS: { id: MaintenanceTicketStatus; label: string }[] = [
  { id: 'open', label: 'Abiertos' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'resolved', label: 'Resueltos' },
  { id: 'closed', label: 'Cerrados' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ticketClusterId(ticket: MaintenanceTicketRow): string | null {
  return ticket.unit?.cluster_id ?? ticket.amenity?.cluster_id ?? null;
}

function ticketScopeLabel(ticket: MaintenanceTicketRow): string {
  return amenityScopeLabel(
    ticketClusterId(ticket),
    ticket.unit?.cluster?.name ?? null,
    'Todo',
  );
}

function RoutineEvidenceGallery({
  evidence,
  period,
  onOpen,
}: {
  evidence: MaintenanceRoutineEvidenceRow[];
  period: MaintenancePeriodFilter;
  onOpen: (path: string) => void;
}) {
  const groups = groupEvidenceByDate(evidence, period);

  if (groups.length === 0) {
    return <p className="mt-2 text-xs text-subtle">Sin evidencia en este periodo.</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {groups.map((group) => (
        <div key={group.date}>
          <p className="text-xs font-semibold text-accent">{group.label}</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {group.items.map((item) => {
              const url = resolveStorageImageUrl(SUPABASE_URL, item.image_url, STORAGE_BUCKETS.MAINTENANCE_FILES);
              return url ? (
                <button key={item.id} type="button" onClick={() => onOpen(item.image_url)} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-16 w-24 rounded-lg border border-white/10 object-cover" />
                </button>
              ) : null;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TicketCard({
  ticket,
  condominiumId,
  pending,
  onRun,
  onOpenFile,
}: {
  ticket: MaintenanceTicketRow;
  condominiumId: string;
  pending: boolean;
  onRun: (
    action: (formData: FormData) => Promise<{ error?: string; success?: boolean }>,
    formData: FormData,
    ok: string,
  ) => void;
  onOpenFile: (path: string) => void;
}) {
  return (
    <GlassCard variant="accent" accent={ticketAccentTone(ticket.status)} className="space-y-3 !p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text)]">{ticket.title}</p>
          <p className="mt-1 text-[11px] text-subtle">
            {ticket.unit?.identifier ? `Unidad ${ticket.unit.identifier}` : 'Área común'}
            {ticket.amenity?.name ? ` · ${ticket.amenity.name}` : ''}
            {' · '}
            {formatDate(ticket.created_at)}
          </p>
        </div>
        <StatusTag label={ticketStatusLabel(ticket.status)} tone={ticketTagTone(ticket.status)} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="glass-tag-blue px-2 py-0.5 text-[10px]">{ticketCategoryLabel(ticket.category)}</span>
        <span className="glass-tag-gray px-2 py-0.5 text-[10px]">{ticketScopeLabel(ticket)}</span>
      </div>

      {ticket.description ? <p className="text-sm text-muted line-clamp-3">{ticket.description}</p> : null}

      <div className="flex flex-wrap gap-2">
        {ticket.photo_url ? (
          <button
            type="button"
            onClick={() => onOpenFile(ticket.photo_url!)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Foto del reporte
          </button>
        ) : null}
        {ticket.attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => onOpenFile(attachment.file_url)}
            className="text-xs font-semibold text-accent-2 hover:underline"
          >
            {attachment.file_name
              ?? (isImageStoragePath(attachment.file_url) ? 'Evidencia' : 'PDF')}
          </button>
        ))}
      </div>

      {ticket.attachments.length > 0 ? (
        <ul className="space-y-1">
          {ticket.attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="truncate">{attachment.file_name ?? attachment.file_url.split('/').pop()}</span>
              <form action={(fd) => onRun(deleteTicketAttachment, fd, 'Adjunto eliminado.')}>
                <input type="hidden" name="attachment_id" value={attachment.id} />
                <button type="submit" disabled={pending} className="text-red-300 hover:underline">
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        action={(fd) => onRun(addTicketAttachment, fd, 'Evidencia agregada.')}
        className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2"
      >
        <input type="hidden" name="ticket_id" value={ticket.id} />
        <FileUpload
          bucket={STORAGE_BUCKETS.MAINTENANCE_FILES}
          inputName="file_url"
          fileNameInputName="file_name"
          label="Agregar evidencia"
          hint="Imagen o PDF (máx. 2 MB / 5 MB)."
          uploadButtonLabel="Subir"
          buildPath={(ext) => maintenanceFilePath(condominiumId, 'tickets', crypto.randomUUID(), ext)}
        />
        <button type="submit" disabled={pending} className="glass-btn-secondary w-full text-xs">
          Guardar adjunto
        </button>
      </form>

      <div className="flex flex-wrap gap-1">
        {MAINTENANCE_TICKET_STATUSES.filter((status) => status !== ticket.status).map((status) => (
          <form key={status} action={(fd) => onRun(updateTicketStatus, fd, 'Ticket actualizado.')}>
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="admin_notes" value={ticket.admin_notes ?? ''} />
            <button type="submit" disabled={pending} className="glass-tag-gray px-2 py-1 text-[10px] hover:opacity-80">
              → {ticketStatusLabel(status)}
            </button>
          </form>
        ))}
      </div>

      <form action={(fd) => onRun(updateTicketStatus, fd, 'Ticket actualizado.')} className="space-y-2">
        <input type="hidden" name="ticket_id" value={ticket.id} />
        <input type="hidden" name="status" value={ticket.status} />
        <textarea
          name="admin_notes"
          rows={2}
          defaultValue={ticket.admin_notes ?? ''}
          placeholder="Notas para el residente"
          className="glass-input text-xs"
        />
        <button type="submit" disabled={pending} className="glass-btn-primary w-full text-xs">
          Guardar notas
        </button>
      </form>
    </GlassCard>
  );
}

export function MaintenanceManager({
  tickets,
  routines,
  amenities,
  clusters,
  condominiumId,
}: {
  tickets: MaintenanceTicketRow[];
  routines: MaintenanceRoutineRow[];
  amenities: AmenityOption[];
  clusters: ClusterOption[];
  condominiumId: string;
}) {
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('tickets');
  const [scopeFilter, setScopeFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<MaintenancePeriodFilter>('month');
  const [routineRecurrence, setRoutineRecurrence] = useState<MaintenanceRecurrence>('weekly');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const routineGroups = useMemo(() => groupRoutinesByWeekday(routines), [routines]);

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        matchesClusterResourceScope(ticketClusterId(ticket), scopeFilter || 'all'),
      ),
    [scopeFilter, tickets],
  );

  const ticketsByStatus = useMemo(() => {
    const map: Record<MaintenanceTicketStatus, MaintenanceTicketRow[]> = {
      open: [],
      in_progress: [],
      resolved: [],
      closed: [],
    };
    for (const ticket of filteredTickets) {
      map[ticket.status].push(ticket);
    }
    return map;
  }, [filteredTickets]);

  function run(
    action: (formData: FormData) => Promise<{ error?: string; success?: boolean }>,
    formData: FormData,
    ok: string,
  ) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? ok);
    });
  }

  async function openFile(path: string) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      window.open(path, '_blank');
      return;
    }
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.MAINTENANCE_FILES).createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="space-y-3">
      <GlassCard className="!p-3">
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

        {clusters.length > 0 ? (
          <div className="mt-3">
            <FinanceScopeFilter
              condominiums={[{ id: condominiumId, name: 'Condominio' }]}
              clusters={clusters}
              condominiumId={condominiumId}
              clusterId={scopeFilter}
              onCondominiumChange={() => {}}
              onClusterChange={setScopeFilter}
              align="start"
              allLabel="Todo"
            />
          </div>
        ) : null}
      </GlassCard>

      {message ? (
        <p className={`text-sm ${message.includes('Error') || message.includes('obligat') ? 'text-red-300' : 'text-accent'}`}>
          {message}
        </p>
      ) : null}

      {tab === 'tickets' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Tablero de reportes. Mueve el estado con los atajos, deja notas y adjunta evidencias (imagen o PDF).
          </p>

          {filteredTickets.length === 0 ? (
            <GlassCard variant="muted">
              <p className="text-sm text-subtle">No hay tickets en este alcance.</p>
            </GlassCard>
          ) : (
            <div className="grid gap-3 xl:grid-cols-4 lg:grid-cols-2">
              {KANBAN_COLUMNS.map((column) => (
                <div key={column.id} className="min-w-0 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-subtle">{column.label}</p>
                    <span className="glass-tag-gray px-2 py-0.5 text-[10px]">
                      {ticketsByStatus[column.id].length}
                    </span>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/30 p-2 min-h-[120px]">
                    {ticketsByStatus[column.id].length === 0 ? (
                      <p className="px-1 py-4 text-center text-xs text-subtle">Sin tickets</p>
                    ) : (
                      ticketsByStatus[column.id].map((ticket) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          condominiumId={condominiumId}
                          pending={pending}
                          onRun={run}
                          onOpenFile={(path) => void openFile(path)}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'mensual' ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <GlassCard>
              <SectionHeading help={HELP.mantenimiento}>Nueva actividad</SectionHeading>
              <p className="mt-1 text-sm text-muted">
                Define el área, qué se hace y cada cuándo (día de la semana y recurrencia).
              </p>
              <form
                action={(fd) => run(createMaintenanceRoutine, fd, 'Actividad agregada.')}
                className="mt-4 space-y-3"
              >
                <input name="title" required placeholder="Ej. Mantenimiento de alberca" className="glass-input" />
                <select name="amenity_id" className="glass-input">
                  <option value="" className="bg-slate-900">
                    Área común (general)
                  </option>
                  {amenities.map((a) => (
                    <option key={a.id} value={a.id} className="bg-slate-900">
                      {a.name}
                    </option>
                  ))}
                </select>
                <select
                  name="recurrence"
                  value={routineRecurrence}
                  onChange={(event) => setRoutineRecurrence(event.target.value as MaintenanceRecurrence)}
                  className="glass-input"
                >
                  {MAINTENANCE_RECURRENCES.map((value) => (
                    <option key={value} value={value} className="bg-slate-900">
                      {RECURRENCE_LABELS[value]}
                    </option>
                  ))}
                </select>
                {routineRecurrence !== 'on_demand' ? (
                  <select name="day_of_week" required className="glass-input" defaultValue="1">
                    {WEEKDAY_ORDER.map((day) => (
                      <option key={day} value={day} className="bg-slate-900">
                        {WEEKDAY_LABELS[day]}
                      </option>
                    ))}
                  </select>
                ) : null}
                {routineRecurrence === 'monthly' ? (
                  <input
                    name="monthly_day"
                    type="number"
                    min={1}
                    max={31}
                    required
                    placeholder="Día del mes (1-31)"
                    className="glass-input"
                  />
                ) : null}
                {routineRecurrence === 'biweekly' ? (
                  <input
                    name="anchor_date"
                    type="date"
                    className="glass-input"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                ) : null}
                <textarea name="description" rows={2} placeholder="Qué incluye el trabajo" className="glass-input" />
                <button type="submit" disabled={pending} className="glass-btn-primary">
                  Agregar actividad
                </button>
              </form>
            </GlassCard>

            <GlassCard>
              <SectionHeading help={HELP.mantenimiento}>Registrar evidencia</SectionHeading>
              <p className="mt-1 text-sm text-muted">
                Sube fotos del trabajo realizado en una fecha concreta. Los residentes las verán etiquetadas por día.
              </p>
              <form
                action={(fd) => run(createMaintenanceRoutineEvidence, fd, 'Evidencia registrada.')}
                className="mt-4 space-y-3"
              >
                <select name="routine_id" required className="glass-input" defaultValue="">
                  <option value="" disabled className="bg-slate-900">
                    Selecciona actividad
                  </option>
                  {routines.map((routine) => (
                    <option key={routine.id} value={routine.id} className="bg-slate-900">
                      {routine.title}
                    </option>
                  ))}
                </select>
                <input
                  name="evidence_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="glass-input"
                />
                <MultiImageUpload
                  bucket={STORAGE_BUCKETS.MAINTENANCE_FILES}
                  label="Fotos de evidencia"
                  hint="Varias fotos del mismo día para la misma actividad."
                  buildPath={(fileId, ext) => maintenanceFilePath(condominiumId, 'routine-evidence', fileId, ext)}
                />
                <button type="submit" disabled={pending} className="glass-btn-primary">
                  Guardar evidencia
                </button>
              </form>
            </GlassCard>
          </div>

          <GlassCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading help={HELP.mantenimiento}>Programa y evidencia</SectionHeading>
              <div className="glass-tab-strip !mb-0">
                {(Object.keys(MAINTENANCE_PERIOD_LABELS) as MaintenancePeriodFilter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPeriodFilter(key)}
                    className={`glass-tab !min-w-0 !flex-none px-4 text-xs ${periodFilter === key ? 'glass-tab-active' : ''}`}
                  >
                    {MAINTENANCE_PERIOD_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">{MAINTENANCE_PERIOD_LABELS[periodFilter]}</p>

            <div className="mt-4 space-y-4">
              {routines.length === 0 ? (
                <p className="text-sm text-subtle">Sin actividades programadas todavía.</p>
              ) : (
                routineGroups.map((group) =>
                  group.items.length === 0 ? null : (
                    <div key={group.label}>
                      <p className="text-xs font-bold uppercase tracking-wide text-subtle">{group.label}</p>
                      <ul className="mt-2 space-y-2">
                        {group.items.map((routine) => {
                          const hasEvidence =
                            groupEvidenceByDate(routine.evidence, periodFilter).length > 0;
                          const cardClass =
                            routineCardVariant(hasEvidence) === 'accent'
                              ? 'glass-card glass-card-accent glass-card-accent-green p-3 text-sm'
                              : 'glass-card-muted p-3 text-sm';
                          return (
                          <li key={routine.id} className={cardClass}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-[var(--text)]">{routine.title}</p>
                                <p className="text-xs text-subtle">
                                  {routine.amenity?.name ?? 'Áreas comunes'}
                                  {' · '}
                                  {recurrenceLabel(routine.recurrence)}
                                  {routine.monthly_day ? ` · día ${routine.monthly_day}` : ''}
                                </p>
                                {routine.description ? (
                                  <p className="mt-1 text-muted">{routine.description}</p>
                                ) : null}
                              </div>
                              <form action={(fd) => run(deleteMaintenanceRoutine, fd, 'Actividad eliminada.')}>
                                <input type="hidden" name="routine_id" value={routine.id} />
                                <button
                                  type="submit"
                                  disabled={pending}
                                  className="text-xs text-red-300 hover:underline"
                                >
                                  Eliminar
                                </button>
                              </form>
                            </div>
                            <RoutineEvidenceGallery
                              evidence={routine.evidence}
                              period={periodFilter}
                              onOpen={(path) => void openFile(path)}
                            />
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                  ),
                )
              )}
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
