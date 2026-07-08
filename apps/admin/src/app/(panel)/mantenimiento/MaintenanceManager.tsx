'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import {
  MAINTENANCE_RECURRENCES,
  MAINTENANCE_TICKET_STATUSES,
  RECURRENCE_LABELS,
  STORAGE_BUCKETS,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  groupRoutinesByWeekday,
  maintenanceFilePath,
  matchesMaintenanceTicketFilter,
  recurrenceLabel,
  resolveStorageImageUrl,
  ticketCategoryLabel,
  ticketStatusLabel,
  type MaintenanceRecurrence,
  type MaintenanceTicketFilter,
} from '@veka/shared';

import { MultiImageUpload } from '@/components/MultiImageUpload';
import { FileUpload } from '@/components/ui/FileUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { createClient } from '@/lib/supabase/client';
import { HELP } from '@/lib/help-content';
import type {
  AmenityOption,
  MaintenanceRoutineRow,
  MaintenanceScheduleRow,
  MaintenanceTicketRow,
  MaintenanceWorkLogRow,
} from '@/lib/load-maintenance';

import {
  createMaintenanceRoutine,
  createWorkLog,
  deleteMaintenanceRoutine,
  updateTicketStatus,
} from './actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

type Tab = 'tickets' | 'calendarios' | 'evidencia';

const TABS: { id: Tab; label: string }[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'calendarios', label: 'Calendarios' },
  { id: 'evidencia', label: 'Evidencia' },
];

const TICKET_FILTERS: { id: MaintenanceTicketFilter; label: string }[] = [
  { id: 'active', label: 'Activos' },
  { id: 'open', label: 'Abiertos' },
  { id: 'closed', label: 'Cerrados' },
  { id: 'all', label: 'Todos' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MaintenanceManager({
  tickets,
  schedules: _schedules,
  routines,
  workLogs,
  amenities,
  condominiumId,
}: {
  tickets: MaintenanceTicketRow[];
  schedules: MaintenanceScheduleRow[];
  routines: MaintenanceRoutineRow[];
  workLogs: MaintenanceWorkLogRow[];
  amenities: AmenityOption[];
  condominiumId: string;
}) {
  const supabase = createClient();
  const evidencePhotoId = useId().replace(/:/g, '');
  const evidenceDocId = useId().replace(/:/g, '');

  const [tab, setTab] = useState<Tab>('tickets');
  const [ticketFilter, setTicketFilter] = useState<MaintenanceTicketFilter>('active');
  const [routineRecurrence, setRoutineRecurrence] = useState<MaintenanceRecurrence>('weekly');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const routineGroups = useMemo(() => groupRoutinesByWeekday(routines), [routines]);

  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => matchesMaintenanceTicketFilter(ticket.status, ticketFilter)),
    [ticketFilter, tickets],
  );

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
    <div className="space-y-6">
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
        <p className={`text-sm ${message.includes('Error') || message.includes('obligat') ? 'text-red-300' : 'text-accent'}`}>
          {message}
        </p>
      ) : null}

      {tab === 'tickets' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Reportes de residentes sobre desperfectos en su unidad o áreas comunes. Actualiza el estado y deja
            notas internas.
          </p>
          <div className="glass-tab-strip">
            {TICKET_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTicketFilter(item.id)}
                className={`glass-tab ${ticketFilter === item.id ? 'glass-tab-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {filteredTickets.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-subtle">No hay tickets en este filtro.</p>
            </GlassCard>
          ) : (
            filteredTickets.map((ticket) => (
              <GlassCard key={ticket.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--text)]">{ticket.title}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {ticket.unit?.identifier ? `Unidad ${ticket.unit.identifier}` : 'Área común'}
                      {ticket.amenity?.name ? ` · ${ticket.amenity.name}` : ''}
                      {' · '}
                      {ticketCategoryLabel(ticket.category)}
                      {' · '}
                      {formatDate(ticket.created_at)}
                    </p>
                    {ticket.description ? <p className="mt-2 text-sm text-muted">{ticket.description}</p> : null}
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-bold">
                    {ticketStatusLabel(ticket.status)}
                  </span>
                </div>

                {ticket.photo_url ? (
                  <button
                    type="button"
                    onClick={() => void openFile(ticket.photo_url!)}
                    className="text-sm text-accent-2 hover:underline"
                  >
                    Ver foto del reporte
                  </button>
                ) : null}

                <form action={(fd) => run(updateTicketStatus, fd, 'Ticket actualizado.')} className="grid gap-2 sm:grid-cols-3">
                  <input type="hidden" name="ticket_id" value={ticket.id} />
                  <select name="status" defaultValue={ticket.status} className="glass-input">
                    {MAINTENANCE_TICKET_STATUSES.map((status) => (
                      <option key={status} value={status} className="bg-slate-900">
                        {ticketStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <input
                    name="admin_notes"
                    defaultValue={ticket.admin_notes ?? ''}
                    placeholder="Notas para el residente"
                    className="glass-input sm:col-span-2"
                  />
                  <button type="submit" disabled={pending} className="glass-btn-primary sm:col-span-3">
                    Guardar seguimiento
                  </button>
                </form>
              </GlassCard>
            ))
          )}
        </div>
      ) : null}

      {tab === 'calendarios' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <SectionHeading help={HELP.mantenimiento}>Nueva actividad</SectionHeading>
            <p className="mt-1 text-sm text-muted">
              Programa tareas por día de la semana: limpieza de alberca, poda, recolección de basura, etc.
            </p>
            <form
              action={(fd) => run(createMaintenanceRoutine, fd, 'Actividad agregada al calendario.')}
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
              <textarea name="description" rows={2} placeholder="Detalles (opcional)" className="glass-input" />
              <MultiImageUpload
                bucket={STORAGE_BUCKETS.MAINTENANCE_FILES}
                label="Fotos de referencia o evidencia"
                hint="Puedes subir varias imágenes. Los residentes las verán en un carrusel."
                buildPath={(fileId, ext) => maintenanceFilePath(condominiumId, 'routines', fileId, ext)}
              />
              <button type="submit" disabled={pending} className="glass-btn-primary">
                Agregar al calendario
              </button>
            </form>
          </GlassCard>

          <GlassCard>
            <SectionHeading help={HELP.mantenimiento}>Calendario semanal</SectionHeading>
            <div className="mt-4 space-y-4">
              {routines.length === 0 ? (
                <p className="text-sm text-subtle">Sin actividades programadas todavía.</p>
              ) : (
                routineGroups.map((group) =>
                  group.items.length === 0 ? null : (
                    <div key={group.label}>
                      <p className="text-xs font-bold uppercase tracking-wide text-subtle">{group.label}</p>
                      <ul className="mt-2 space-y-2">
                        {group.items.map((routine) => (
                          <li key={routine.id} className="glass-card-deep p-3 text-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-[var(--text)]">{routine.title}</p>
                                <p className="text-xs text-subtle">
                                  {recurrenceLabel(routine.recurrence)}
                                  {routine.amenity?.name ? ` · ${routine.amenity.name}` : ''}
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
                            {routine.images.length > 0 ? (
                              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                                {routine.images.map((image) => {
                                  const url = resolveStorageImageUrl(
                                    SUPABASE_URL,
                                    image.image_url,
                                    STORAGE_BUCKETS.MAINTENANCE_FILES,
                                  );
                                  return url ? (
                                    <button
                                      key={image.id}
                                      type="button"
                                      onClick={() => window.open(url, '_blank')}
                                      className="shrink-0"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={url}
                                        alt=""
                                        className="h-16 w-24 rounded-lg border border-white/10 object-cover"
                                      />
                                    </button>
                                  ) : null;
                                })}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )
              )}
            </div>
          </GlassCard>
        </div>
      ) : null}

      {tab === 'evidencia' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <SectionHeading help={HELP.mantenimiento}>Registrar evidencia</SectionHeading>
            <p className="mt-1 text-sm text-muted">Trabajos realizados en áreas comunes con foto o documento.</p>
            <form action={(fd) => run(createWorkLog, fd, 'Evidencia registrada.')} className="mt-4 space-y-3">
              <input name="title" required placeholder="Ej. Limpieza profunda alberca" className="glass-input" />
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
              <select name="ticket_id" className="glass-input">
                <option value="" className="bg-slate-900">
                  Sin ticket vinculado
                </option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900">
                    {t.title}
                  </option>
                ))}
              </select>
              <input
                name="work_date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="glass-input"
              />
              <textarea name="description" rows={2} placeholder="Descripción del trabajo" className="glass-input" />
              <FileUpload
                bucket={STORAGE_BUCKETS.MAINTENANCE_FILES}
                inputName="photo_url"
                label="Foto del trabajo"
                hint="Opcional si adjuntas documento."
                buildPath={(ext) => maintenanceFilePath(condominiumId, 'evidence', evidencePhotoId, ext)}
              />
              <FileUpload
                bucket={STORAGE_BUCKETS.MAINTENANCE_FILES}
                inputName="file_url"
                label="Documento adicional"
                hint="PDF o imagen complementaria."
                buildPath={(ext) => maintenanceFilePath(condominiumId, 'evidence', evidenceDocId, ext)}
              />
              <button type="submit" disabled={pending} className="glass-btn-primary">
                Guardar evidencia
              </button>
            </form>
          </GlassCard>

          <GlassCard>
            <SectionHeading help={HELP.mantenimiento}>Historial de trabajos</SectionHeading>
            <ul className="mt-4 space-y-3">
              {workLogs.length === 0 ? (
                <li className="text-sm text-subtle">Sin evidencia registrada.</li>
              ) : (
                workLogs.map((log) => (
                  <li key={log.id} className="glass-card-deep p-3 text-sm">
                    <p className="font-medium text-[var(--text)]">{log.title}</p>
                    <p className="text-xs text-subtle">
                      {log.amenity?.name ?? 'General'} · {log.work_date}
                      {log.ticket?.title ? ` · Ticket: ${log.ticket.title}` : ''}
                    </p>
                    {log.description ? <p className="mt-1 text-muted">{log.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {log.photo_url ? (
                        <button
                          type="button"
                          onClick={() => void openFile(log.photo_url!)}
                          className="text-accent-2 hover:underline"
                        >
                          Ver foto
                        </button>
                      ) : null}
                      {log.file_url ? (
                        <button
                          type="button"
                          onClick={() => void openFile(log.file_url!)}
                          className="text-accent-2 hover:underline"
                        >
                          Ver documento
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
