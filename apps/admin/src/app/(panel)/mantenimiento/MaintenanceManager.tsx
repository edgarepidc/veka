'use client';

import { useId, useState, useTransition } from 'react';
import {
  MAINTENANCE_TICKET_STATUSES,
  STORAGE_BUCKETS,
  maintenanceFilePath,
  ticketCategoryLabel,
  ticketStatusLabel,
} from '@veka/shared';

import { FileUpload } from '@/components/ui/FileUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { createClient } from '@/lib/supabase/client';
import { DEMO_CONDO_ID } from '@/lib/constants';
import { HELP } from '@/lib/help-content';
import type {
  AmenityOption,
  MaintenanceScheduleRow,
  MaintenanceTicketRow,
  MaintenanceWorkLogRow,
} from '@/lib/load-maintenance';

import { createMaintenanceSchedule, createWorkLog, updateTicketStatus } from './actions';

type Tab = 'tickets' | 'calendarios' | 'evidencia';

const TABS: { id: Tab; label: string }[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'calendarios', label: 'Calendarios' },
  { id: 'evidencia', label: 'Evidencia' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MaintenanceManager({
  tickets,
  schedules,
  workLogs,
  amenities,
}: {
  tickets: MaintenanceTicketRow[];
  schedules: MaintenanceScheduleRow[];
  workLogs: MaintenanceWorkLogRow[];
  amenities: AmenityOption[];
}) {
  const supabase = createClient();
  const scheduleFileId = useId().replace(/:/g, '');
  const evidencePhotoId = useId().replace(/:/g, '');
  const evidenceDocId = useId().replace(/:/g, '');

  const [tab, setTab] = useState<Tab>('tickets');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
          {tickets.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-subtle">No hay tickets abiertos.</p>
            </GlassCard>
          ) : (
            tickets.map((ticket) => (
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
            <SectionHeading help={HELP.mantenimiento}>Publicar calendario</SectionHeading>
            <p className="mt-1 text-sm text-muted">
              Mantenimiento programado de alberca, gimnasio y otras áreas comunes.
            </p>
            <form
              action={(fd) => run(createMaintenanceSchedule, fd, 'Calendario publicado.')}
              className="mt-4 space-y-3"
            >
              <input name="title" required placeholder="Ej. Mantenimiento alberca — Julio" className="glass-input" />
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
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="period_start" type="date" className="glass-input" />
                <input name="period_end" type="date" className="glass-input" />
              </div>
              <textarea name="description" rows={2} placeholder="Detalles (opcional)" className="glass-input" />
              <FileUpload
                bucket={STORAGE_BUCKETS.MAINTENANCE_FILES}
                inputName="file_url"
                label="Calendario o aviso"
                hint="Imagen o PDF del calendario de mantenimiento."
                buildPath={(ext) => maintenanceFilePath(DEMO_CONDO_ID, 'schedules', scheduleFileId, ext)}
              />
              <button type="submit" disabled={pending} className="glass-btn-primary">
                Publicar calendario
              </button>
            </form>
          </GlassCard>

          <GlassCard>
            <SectionHeading help={HELP.mantenimiento}>Calendarios publicados</SectionHeading>
            <ul className="mt-4 space-y-3">
              {schedules.length === 0 ? (
                <li className="text-sm text-subtle">Sin calendarios todavía.</li>
              ) : (
                schedules.map((schedule) => (
                  <li key={schedule.id} className="glass-card-deep p-3 text-sm">
                    <p className="font-medium text-[var(--text)]">{schedule.title}</p>
                    <p className="text-xs text-subtle">
                      {schedule.amenity?.name ?? 'General'}
                      {schedule.period_start ? ` · ${schedule.period_start}` : ''}
                      {schedule.period_end ? ` – ${schedule.period_end}` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => void openFile(schedule.file_url)}
                      className="mt-2 text-accent-2 hover:underline"
                    >
                      Ver documento
                    </button>
                  </li>
                ))
              )}
            </ul>
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
                buildPath={(ext) => maintenanceFilePath(DEMO_CONDO_ID, 'evidence', evidencePhotoId, ext)}
              />
              <FileUpload
                bucket={STORAGE_BUCKETS.MAINTENANCE_FILES}
                inputName="file_url"
                label="Documento adicional"
                hint="PDF o imagen complementaria."
                buildPath={(ext) => maintenanceFilePath(DEMO_CONDO_ID, 'evidence', evidenceDocId, ext)}
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
