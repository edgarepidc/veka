'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  ASSEMBLY_STATUSES,
  ASSEMBLY_STATUS_LABELS,
  STORAGE_BUCKETS,
  matchesCommunityClusterScope,
  ticketStatusLabel,
  type AssemblyStatus,
  type MaintenanceTicketStatus,
} from '@veka/shared';

import {
  addAssemblyAgreement,
  createAssembly,
  deleteAssembly,
  linkAssemblyDocument,
  linkAssemblyPost,
  removeAssemblyAgreement,
  toggleAssemblyAgreement,
  unlinkAssemblyDocument,
  unlinkAssemblyPost,
  updateAssembly,
} from '@/app/(panel)/comunidad/assembly-actions';
import { AssemblyLinkedPostCard } from '@/components/AssemblyLinkedPostCard';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import type {
  AssemblyRow,
  AssemblyTicketOption,
} from '@/lib/load-assemblies';
import type { CommunityDocumentRow, CommunityPostRow } from '@/lib/load-community';

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAssemblyDate(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function postTypeLabel(type: string): string {
  if (type === 'poll') return 'Encuesta';
  if (type === 'photo') return 'Aviso (foto)';
  return 'Aviso';
}

export function AssembliesPanel({
  condominiumId,
  clusterId,
  scopeLabel,
  assemblies,
  posts,
  documents,
  tickets,
}: {
  condominiumId: string;
  clusterId: string;
  scopeLabel: string;
  assemblies: AssemblyRow[];
  posts: CommunityPostRow[];
  documents: CommunityDocumentRow[];
  tickets: AssemblyTicketOption[];
}) {
  const supabase = createClient();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const visibleAssemblies = useMemo(
    () =>
      assemblies.filter((assembly) => {
        if (!clusterId) return true;
        if (assembly.clusters.length === 0) return true;
        return assembly.clusters.some((cluster) => cluster.id === clusterId);
      }),
    [assemblies, clusterId],
  );

  const selected =
    visibleAssemblies.find((row) => row.id === selectedId) ??
    visibleAssemblies[0] ??
    null;

  const linkedPostIds = useMemo(
    () => new Set(selected?.posts.map((post) => post.id) ?? []),
    [selected],
  );
  const linkedDocumentIds = useMemo(
    () => new Set(selected?.documents.map((doc) => doc.id) ?? []),
    [selected],
  );

  const availablePosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          !post.is_archived &&
          (post.post_type === 'announcement' ||
            post.post_type === 'poll' ||
            post.post_type === 'photo') &&
          !linkedPostIds.has(post.id) &&
          matchesCommunityClusterScope(post.clusters, clusterId || 'all'),
      ),
    [clusterId, linkedPostIds, posts],
  );

  const availableDocuments = useMemo(
    () =>
      documents.filter(
        (doc) =>
          !linkedDocumentIds.has(doc.id) &&
          matchesCommunityClusterScope(doc.clusters, clusterId || 'all'),
      ),
    [clusterId, documents, linkedDocumentIds],
  );

  const postsById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);

  const linkedPostDetails = useMemo(
    () =>
      (selected?.posts ?? [])
        .map((linked) => postsById.get(linked.id))
        .filter((post): post is CommunityPostRow => Boolean(post)),
    [postsById, selected?.posts],
  );

  function run(action: () => Promise<{ error?: string }>, success: string) {
    setMessage(null);
    start(async () => {
      const result = await action();
      setMessage(result.error ?? success);
    });
  }

  async function openDocument(pathOrUrl: string) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      window.open(pathOrUrl, '_blank');
      return;
    }
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.DOCUMENTS).createSignedUrl(pathOrUrl, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="space-y-3">
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Asambleas</h2>
            <p className="mt-1 text-sm text-muted">
              Expediente por asamblea · {scopeLabel}. Vincula avisos, encuestas y documentos ya
              publicados; da seguimiento a acuerdos con tickets.
            </p>
          </div>
          <button
            type="button"
            className="glass-btn-primary"
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? 'Cancelar' : 'Nueva asamblea'}
          </button>
        </div>

        {createOpen ? (
          <form
            className="mt-4 grid gap-2 sm:grid-cols-2"
            action={(formData) =>
              run(async () => {
                const result = await createAssembly(formData);
                if (!result.error && result.id) {
                  setSelectedId(result.id);
                  setCreateOpen(false);
                }
                return result;
              }, 'Asamblea creada.')
            }
          >
            <input type="hidden" name="condominium_id" value={condominiumId} />
            <input type="hidden" name="cluster_id" value={clusterId} />
            <Field label="Título" name="title" required placeholder="Asamblea ordinaria 2026" />
            <Field label="Fecha y hora" name="scheduled_at" type="datetime-local" />
            <label className="text-sm text-muted sm:col-span-2">
              Estado
              <select name="status" defaultValue="scheduled" className="glass-input mt-1 w-full">
                {ASSEMBLY_STATUSES.map((status) => (
                  <option key={status} value={status} className="bg-slate-900">
                    {ASSEMBLY_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-muted sm:col-span-2">
              Notas
              <textarea name="notes" rows={2} className="glass-input mt-1 w-full" placeholder="Opcional" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={pending} className="glass-btn-primary">
                {pending ? 'Guardando…' : 'Crear asamblea'}
              </button>
            </div>
          </form>
        ) : null}
      </GlassCard>

      <div className="grid gap-3 lg:grid-cols-[16rem_1fr]">
        <GlassCard className="!p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Listado</p>
          <ul className="space-y-1">
            {visibleAssemblies.length === 0 ? (
              <li className="px-2 py-3 text-sm text-subtle">Sin asambleas en este alcance.</li>
            ) : (
              visibleAssemblies.map((assembly) => {
                const active = selected?.id === assembly.id;
                return (
                  <li key={assembly.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(assembly.id)}
                      className={`w-full rounded-xl px-3 py-2 text-left transition ${
                        active ? 'bg-white/10 text-[var(--text)]' : 'text-muted hover:bg-white/5'
                      }`}
                    >
                      <p className="text-sm font-medium">{assembly.title}</p>
                      <p className="mt-0.5 text-[11px] text-subtle">
                        {assembly.statusLabel} · {formatAssemblyDate(assembly.scheduledAt)}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </GlassCard>

        {selected ? (
          <div className="space-y-3">
            <GlassCard>
              <form
                className="grid gap-2 sm:grid-cols-2"
                action={(formData) => run(() => updateAssembly(formData), 'Asamblea actualizada.')}
              >
                <input type="hidden" name="condominium_id" value={condominiumId} />
                <input type="hidden" name="assembly_id" value={selected.id} />
                <Field label="Título" name="title" required defaultValue={selected.title} />
                <Field
                  label="Fecha y hora"
                  name="scheduled_at"
                  type="datetime-local"
                  defaultValue={toDatetimeLocalValue(selected.scheduledAt)}
                />
                <label className="text-sm text-muted">
                  Estado
                  <select
                    name="status"
                    defaultValue={selected.status}
                    className="glass-input mt-1 w-full"
                  >
                    {ASSEMBLY_STATUSES.map((status) => (
                      <option key={status} value={status} className="bg-slate-900">
                        {ASSEMBLY_STATUS_LABELS[status as AssemblyStatus]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <p className="text-xs text-subtle">
                    Alcance:{' '}
                    {selected.clusters.length === 0
                      ? 'Condominio general'
                      : selected.clusters.map((c) => c.name).join(', ')}
                  </p>
                </div>
                <label className="text-sm text-muted sm:col-span-2">
                  Notas
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={selected.notes ?? ''}
                    className="glass-input mt-1 w-full"
                  />
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button type="submit" disabled={pending} className="glass-btn-primary">
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="glass-btn px-3 py-2 text-sm"
                    onClick={() => {
                      if (!confirm('¿Eliminar esta asamblea y sus vínculos?')) return;
                      run(async () => {
                        const result = await deleteAssembly(selected.id);
                        if (!result.error) setSelectedId(null);
                        return result;
                      }, 'Asamblea eliminada.');
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </form>
            </GlassCard>

            <GlassCard>
              <h3 className="text-sm font-semibold text-[var(--text)]">Avisos y encuestas</h3>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                action={(formData) =>
                  run(() => linkAssemblyPost(formData), 'Publicación vinculada.')
                }
              >
                <input type="hidden" name="condominium_id" value={condominiumId} />
                <input type="hidden" name="assembly_id" value={selected.id} />
                <select name="post_id" required className="glass-input min-w-0 flex-1">
                  <option value="" className="bg-slate-900">
                    Selecciona aviso o encuesta…
                  </option>
                  {availablePosts.map((post) => (
                    <option key={post.id} value={post.id} className="bg-slate-900">
                      {postTypeLabel(post.post_type)} · {post.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending || availablePosts.length === 0}
                  className="glass-btn-primary shrink-0"
                >
                  Vincular
                </button>
              </form>
              <ul className="mt-3 space-y-2">
                {linkedPostDetails.length === 0 ? (
                  <li className="text-sm text-subtle">Sin publicaciones vinculadas.</li>
                ) : (
                  linkedPostDetails.map((post) => (
                    <AssemblyLinkedPostCard
                      key={post.id}
                      post={post}
                      removing={pending}
                      onRemove={() =>
                        run(
                          () => unlinkAssemblyPost(selected.id, post.id),
                          'Publicación desvinculada.',
                        )
                      }
                    />
                  ))
                )}
              </ul>
            </GlassCard>

            <GlassCard>
              <h3 className="text-sm font-semibold text-[var(--text)]">Documentos</h3>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                action={(formData) =>
                  run(() => linkAssemblyDocument(formData), 'Documento vinculado.')
                }
              >
                <input type="hidden" name="condominium_id" value={condominiumId} />
                <input type="hidden" name="assembly_id" value={selected.id} />
                <select name="document_id" required className="glass-input min-w-0 flex-1">
                  <option value="" className="bg-slate-900">
                    Selecciona documento…
                  </option>
                  {availableDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id} className="bg-slate-900">
                      {doc.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending || availableDocuments.length === 0}
                  className="glass-btn-primary shrink-0"
                >
                  Vincular
                </button>
              </form>
              <ul className="mt-3 space-y-2">
                {selected.documents.length === 0 ? (
                  <li className="text-sm text-subtle">Sin documentos vinculados.</li>
                ) : (
                  selected.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="glass-card-deep flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <button
                        type="button"
                        className="text-left text-sm text-[var(--text)] underline-offset-2 hover:underline"
                        onClick={() => void openDocument(doc.fileUrl)}
                      >
                        {doc.title}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="glass-btn px-2 py-1 text-xs"
                        onClick={() =>
                          run(
                            () => unlinkAssemblyDocument(selected.id, doc.id),
                            'Documento desvinculado.',
                          )
                        }
                      >
                        Quitar
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </GlassCard>

            <GlassCard>
              <h3 className="text-sm font-semibold text-[var(--text)]">Acuerdos (checklist)</h3>
              <form
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto]"
                action={(formData) =>
                  run(() => addAssemblyAgreement(formData), 'Acuerdo agregado.')
                }
              >
                <input type="hidden" name="condominium_id" value={condominiumId} />
                <input type="hidden" name="assembly_id" value={selected.id} />
                <input
                  name="title"
                  required
                  placeholder="Acuerdo a dar seguimiento…"
                  className="glass-input"
                />
                <select name="ticket_id" className="glass-input">
                  <option value="" className="bg-slate-900">
                    Sin ticket
                  </option>
                  {tickets.map((ticket) => (
                    <option key={ticket.id} value={ticket.id} className="bg-slate-900">
                      {ticket.title} ·{' '}
                      {ticketStatusLabel(ticket.status as MaintenanceTicketStatus)}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={pending} className="glass-btn-primary">
                  Agregar
                </button>
              </form>
              <ul className="mt-3 space-y-2">
                {selected.agreements.length === 0 ? (
                  <li className="text-sm text-subtle">Sin acuerdos registrados.</li>
                ) : (
                  selected.agreements.map((agreement) => (
                    <li
                      key={agreement.id}
                      className="glass-card-deep flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                    >
                      <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={agreement.isDone}
                          disabled={pending}
                          onChange={(event) =>
                            run(
                              () =>
                                toggleAssemblyAgreement(agreement.id, event.target.checked),
                              event.target.checked
                                ? 'Acuerdo marcado como cumplido.'
                                : 'Acuerdo reabierto.',
                            )
                          }
                          className="mt-0.5 h-4 w-4 rounded border-white/20"
                        />
                        <span>
                          <span
                            className={
                              agreement.isDone
                                ? 'text-subtle line-through'
                                : 'text-[var(--text)]'
                            }
                          >
                            {agreement.title}
                          </span>
                          {agreement.ticketTitle ? (
                            <span className="mt-0.5 block text-xs text-subtle">
                              Ticket: {agreement.ticketTitle}
                              {agreement.ticketStatus
                                ? ` · ${ticketStatusLabel(agreement.ticketStatus as MaintenanceTicketStatus)}`
                                : ''}
                            </span>
                          ) : null}
                        </span>
                      </label>
                      <button
                        type="button"
                        disabled={pending}
                        className="glass-btn px-2 py-1 text-xs"
                        onClick={() =>
                          run(
                            () => removeAssemblyAgreement(agreement.id),
                            'Acuerdo eliminado.',
                          )
                        }
                      >
                        Quitar
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </GlassCard>
          </div>
        ) : (
          <GlassCard>
            <p className="text-sm text-subtle">
              Crea una asamblea para vincular convocatoria, votaciones, actas y acuerdos.
            </p>
          </GlassCard>
        )}
      </div>

      {message ? (
        <p
          className={`text-sm ${
            /creada|actualizada|vinculad|agregado|cumplido|eliminad|desvinculad|reabierto/i.test(
              message,
            )
              ? 'text-accent'
              : 'text-red-300'
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm text-muted">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="glass-input mt-1 w-full"
      />
    </label>
  );
}
