'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  documentStoragePath,
  buildCommentTree,
  computePollQuorumResult,
  flattenCommentTree,
  formatClusterScopeLabel,
  isImageStoragePath,
  isPollClosed,
  pollCloseLabel,
  postImagePath,
  STORAGE_BUCKETS,
} from '@veka/shared';

import { setActiveCondominium } from '@/app/(panel)/configuracion/condominio/actions/set-active-condo';
import { AssembliesPanel } from '@/components/AssembliesPanel';
import { AssemblyPublishSelect } from '@/components/AssemblyPublishSelect';
import { CommunityTeamRoster } from '@/components/CommunityTeamRoster';
import { FinanceScopeFilter } from '@/components/FinanceScopeFilter';
import { VigilanceCommitteePanel } from '@/components/VigilanceCommitteePanel';
import { FileUpload } from '@/components/ui/FileUpload';
import { GlassCard } from '@/components/ui/GlassCard';
import { HelpHint } from '@/components/ui/HelpHint';
import { createClient } from '@/lib/supabase/client';
import { HELP } from '@/lib/help-content';
import type { ClusterOption } from '@/lib/community-clusters';
import type { CommunityDocumentRow, CommunityPostRow } from '@/lib/load-community';
import type { AssemblyRow, AssemblyTicketOption } from '@/lib/load-assemblies';
import type { ManualDirectoryEntry } from '@/lib/load-manual-directory';
import type { CommunityDirectoryMember } from '@/lib/load-community-directory';
import type { CommitteeMemberRow, ResidentDirectoryRow } from '@/lib/load-committee';

import {
  archivePost,
  closePoll,
  createAnnouncement,
  createPoll,
  deleteComment,
  exportPollResults,
  unpinPost,
  uploadDocument,
} from './actions';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function PostAttachmentPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = isImageStoragePath(path);

  useEffect(() => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      setUrl(path);
      return;
    }
    const supabase = createClient();
    void supabase.storage.from(STORAGE_BUCKETS.POSTS).createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);

  if (!url) return null;

  if (isImage) {
    return (
      <img
        src={url}
        alt=""
        className="mt-3 max-h-48 w-full rounded-xl border border-white/10 object-cover"
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-accent"
    >
      Ver PDF adjunto
    </a>
  );
}

type ContentTab = 'announcement' | 'poll' | 'document' | 'mi-comunidad' | 'asambleas';
type PeriodFilter = 'month' | 'quarter' | 'all';
type PublishTab = 'announcement' | 'poll' | 'document';

const TABS: { id: ContentTab; label: string }[] = [
  { id: 'announcement', label: 'Avisos' },
  { id: 'poll', label: 'Encuestas' },
  { id: 'document', label: 'Documentos' },
  { id: 'mi-comunidad', label: 'Mi comunidad' },
  { id: 'asambleas', label: 'Asambleas' },
];

const TAB_HELP: Record<ContentTab, string> = {
  announcement: HELP.comunidad.avisos,
  poll: HELP.comunidad.encuestas,
  document: HELP.comunidad.documentos,
  'mi-comunidad': HELP.comunidad.miComunidad,
  asambleas: HELP.comunidad.asambleas,
};

const PUBLISH_LABEL: Record<PublishTab, string> = {
  announcement: 'Publicar aviso',
  poll: 'Publicar encuesta',
  document: 'Publicar documento',
};

function isPublishTab(tab: ContentTab): tab is PublishTab {
  return tab === 'announcement' || tab === 'poll' || tab === 'document';
}

const PERIOD_FILTER_LABELS: Record<PeriodFilter, string> = {
  month: 'Mes actual',
  quarter: 'Últimos 3 meses',
  all: 'Histórico',
};

function isInPeriod(iso: string, period: PeriodFilter): boolean {
  const date = new Date(iso);
  const now = new Date();
  if (period === 'all') return true;
  if (period === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return date >= threeMonthsAgo;
}

function isAnnouncementPost(post: CommunityPostRow): boolean {
  return post.post_type === 'announcement' || post.post_type === 'photo';
}

function matchesClusterScope(
  clusters: { id: string }[],
  selectedClusterId: string,
): boolean {
  if (!selectedClusterId) return true;
  if (clusters.length === 0) return true;
  return clusters.some((cluster) => cluster.id === selectedClusterId);
}

function PublishScopeFields({ selectedClusterId }: { selectedClusterId: string }) {
  if (!selectedClusterId) {
    return <input type="hidden" name="scope_mode" value="all" />;
  }
  return (
    <>
      <input type="hidden" name="scope_mode" value="clusters" />
      <input type="hidden" name="cluster_ids" value={selectedClusterId} />
    </>
  );
}

export function CommunityManager({
  posts: initialPosts,
  documents: initialDocuments,
  condominiums,
  initialCondominiumId,
  clusters: initialClusters,
  directoryMembers,
  manualStaff,
  residents,
  vigilanceMembers,
  assemblies: initialAssemblies,
  assemblyTickets,
}: {
  posts: CommunityPostRow[];
  documents: CommunityDocumentRow[];
  condominiums: { id: string; name: string }[];
  initialCondominiumId: string;
  clusters: ClusterOption[];
  directoryMembers: CommunityDirectoryMember[];
  manualStaff: ManualDirectoryEntry[];
  residents: ResidentDirectoryRow[];
  vigilanceMembers: CommitteeMemberRow[];
  assemblies: AssemblyRow[];
  assemblyTickets: AssemblyTicketOption[];
}) {
  const supabase = createClient();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<ContentTab>('announcement');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [selectedCondoId, setSelectedCondoId] = useState(initialCondominiumId);
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [clusters, setClusters] = useState(initialClusters);
  const [posts, setPosts] = useState(initialPosts);
  const [documents, setDocuments] = useState(initialDocuments);
  const [directoryRows, setDirectoryRows] = useState(directoryMembers);
  const [residentRows, setResidentRows] = useState(residents);
  const [vigilanceRows, setVigilanceRows] = useState(vigilanceMembers);
  const [assemblies, setAssemblies] = useState(initialAssemblies);
  const [ticketOptions, setTicketOptions] = useState(assemblyTickets);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    setPosts(initialPosts);
    setDocuments(initialDocuments);
    setClusters(initialClusters);
    setDirectoryRows(directoryMembers);
    setResidentRows(residents);
    setVigilanceRows(vigilanceMembers);
    setAssemblies(initialAssemblies);
    setTicketOptions(assemblyTickets);
    setSelectedCondoId(initialCondominiumId);
    setSelectedClusterId('');
    setPublishOpen(false);
  }, [
    initialPosts,
    initialDocuments,
    initialClusters,
    directoryMembers,
    residents,
    vigilanceMembers,
    initialAssemblies,
    assemblyTickets,
    initialCondominiumId,
  ]);

  useEffect(() => {
    if (!publishOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPublishOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [publishOpen]);

  const filteredPosts = useMemo(() => {
    const byType =
      tab === 'announcement'
        ? posts.filter(isAnnouncementPost)
        : tab === 'poll'
          ? posts.filter((post) => post.post_type === 'poll')
          : [];

    return byType
      .filter((post) => isInPeriod(post.created_at, periodFilter))
      .filter((post) => matchesClusterScope(post.clusters, selectedClusterId));
  }, [periodFilter, posts, selectedClusterId, tab]);

  const filteredDocuments = useMemo(
    () =>
      documents
        .filter((doc) => isInPeriod(doc.created_at, periodFilter))
        .filter((doc) => matchesClusterScope(doc.clusters, selectedClusterId)),
    [documents, periodFilter, selectedClusterId],
  );

  const scopedResidents = useMemo(
    () =>
      selectedClusterId
        ? residentRows.filter((row) => row.clusterId === selectedClusterId)
        : residentRows,
    [residentRows, selectedClusterId],
  );

  const scopeLabel = selectedClusterId
    ? (clusters.find((cluster) => cluster.id === selectedClusterId)?.name ?? 'Torre')
    : 'Todo el condominio';

  async function handleCondoChange(nextId: string) {
    if (nextId === selectedCondoId) return;
    setSelectedCondoId(nextId);
    setSelectedClusterId('');
    setMessage(null);
    const result = await setActiveCondominium(nextId);
    if (result.error) {
      setMessage(result.error);
      setSelectedCondoId(initialCondominiumId);
    }
  }

  function runAction(
    action: () => Promise<{ error?: string; success?: boolean; message?: string; text?: string }>,
    ok: string,
  ) {
    setMessage(null);
    start(async () => {
      const result = await action();
      if (result.text) {
        const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `encuesta-${Date.now()}.txt`;
        link.click();
        URL.revokeObjectURL(url);
      }
      setMessage(result.error ?? result.message ?? ok);
    });
  }

  function runClose(postId: string) {
    runAction(() => closePoll(postId), 'Encuesta cerrada.');
  }

  function run(
    action: (formData: FormData) => Promise<{ error?: string; success?: boolean; message?: string }>,
    formData: FormData,
    ok: string,
  ) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? result.message ?? ok);
      if (!result.error) setPublishOpen(false);
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

  const publishTab = isPublishTab(tab) ? tab : null;

  return (
    <div className="space-y-3">
      <GlassCard className="!p-3">
        <div className="flex items-start gap-2">
          <div className="glass-tab-strip min-w-0 flex-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setPublishOpen(false);
                }}
                className={`glass-tab ${tab === item.id ? 'glass-tab-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <HelpHint label="Ayuda de esta pestaña" className="mt-1 shrink-0">
            <p>{TAB_HELP[tab]}</p>
          </HelpHint>
        </div>

        <div className="mt-3">
          <FinanceScopeFilter
            condominiums={condominiums.length > 0 ? condominiums : [{ id: selectedCondoId, name: 'Condominio' }]}
            clusters={clusters}
            condominiumId={selectedCondoId}
            clusterId={selectedClusterId}
            onCondominiumChange={(id) => void handleCondoChange(id)}
            onClusterChange={setSelectedClusterId}
            align="end"
          />
        </div>
      </GlassCard>

      {isPublishTab(tab) ? (
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-[var(--text)]">
                {tab === 'announcement' ? 'Avisos' : tab === 'poll' ? 'Encuestas' : 'Documentos'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {tab === 'announcement'
                  ? 'Comunicados visibles para residentes en la app.'
                  : tab === 'poll'
                    ? 'Votaciones formales o informales con resultados y actas.'
                    : 'Archivos del condominio (reglamento, minutas, etc.).'}
              </p>
            </div>
            <div className="glass-tab-strip inline-flex shrink-0" role="group">
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="glass-tab glass-tab-active !min-w-0 !flex-none px-2.5 py-1.5 text-xs"
              >
                {PUBLISH_LABEL[tab]}
              </button>
            </div>
          </div>

          <div className="glass-tab-strip mt-4 mb-4">
            {(Object.keys(PERIOD_FILTER_LABELS) as PeriodFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriodFilter(key)}
                className={`glass-tab !min-w-0 !flex-none px-4 text-xs ${periodFilter === key ? 'glass-tab-active' : ''}`}
              >
                {PERIOD_FILTER_LABELS[key]}
              </button>
            ))}
          </div>

          <p className="mb-4 text-xs text-subtle">
            {tab === 'document'
              ? `${filteredDocuments.length} documento${filteredDocuments.length === 1 ? '' : 's'} · ${PERIOD_FILTER_LABELS[periodFilter].toLowerCase()}`
              : `${filteredPosts.length} ${tab === 'poll' ? 'encuesta' : 'aviso'}${filteredPosts.length === 1 ? '' : 's'} · ${PERIOD_FILTER_LABELS[periodFilter].toLowerCase()}`}
            {selectedClusterId
              ? ` · ${clusters.find((cluster) => cluster.id === selectedClusterId)?.name ?? 'Torre'}`
              : ''}
          </p>

          {tab === 'document' ? (
            <ul className="space-y-3">
              {filteredDocuments.length === 0 ? (
                <li className="text-sm text-subtle">No hay documentos en este período.</li>
              ) : (
                filteredDocuments.map((doc) => (
                  <li key={doc.id} className="glass-card-deep flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-[var(--text)]">{doc.title}</p>
                      <p className="text-xs text-subtle">
                        {doc.category} · {formatClusterScopeLabel(doc.clusters)} · {timeAgo(doc.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openDocument(doc.file_url)}
                      className="glass-btn-secondary shrink-0 text-xs"
                    >
                      Abrir
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <ul className="space-y-3">
              {filteredPosts.length === 0 ? (
                <li className="text-sm text-subtle">No hay publicaciones en este período.</li>
              ) : (
                filteredPosts.map((post) => {
                  const pollClosed = post.post_type === 'poll' && isPollClosed(post);
                  const closeLabel = post.post_type === 'poll' ? pollCloseLabel(post) : null;
                  const quorumResult =
                    post.post_type === 'poll'
                      ? computePollQuorumResult({
                          options: post.poll_options,
                          totalVotes: post.total_votes,
                          eligibleVoters: post.eligible_voters,
                          quorumPercent: post.quorum_percent,
                          isFormal: post.is_formal,
                          isClosed: pollClosed,
                        })
                      : null;

                  return (
                    <li
                      key={post.id}
                      className={`glass-card-deep px-4 py-3 ${post.is_archived ? 'opacity-60' : ''}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="glass-tag-blue text-[10px]">
                          {post.post_type === 'poll' ? 'Encuesta' : post.post_type === 'photo' ? 'Foto' : 'Aviso'}
                        </span>
                        {post.is_archived ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">
                            Archivado
                          </span>
                        ) : null}
                        {post.post_type === 'poll' ? (
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide ${post.is_formal ? 'text-status-amber' : 'text-sky-200'}`}
                          >
                            {post.is_formal ? 'Formal' : 'Informal'}
                          </span>
                        ) : null}
                        {post.post_type === 'poll' && post.require_payment_current ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-status-green">
                            Al corriente
                          </span>
                        ) : null}
                        {pollClosed ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-300">
                            Cerrada
                          </span>
                        ) : null}
                        {post.is_pinned ? <span className="text-[10px] text-accent">Fijado</span> : null}
                        <span className="text-[10px] text-subtle">{formatClusterScopeLabel(post.clusters)}</span>
                        <span className="text-xs text-subtle">{timeAgo(post.created_at)}</span>
                      </div>
                      <p className="mt-2 font-medium text-[var(--text)]">{post.title}</p>
                      {post.body ? <p className="mt-1 text-sm text-muted">{post.body}</p> : null}
                      {post.image_url ? <PostAttachmentPreview path={post.image_url} /> : null}
                      {closeLabel ? <p className="mt-1 text-xs text-subtle">{closeLabel}</p> : null}
                      {post.post_type === 'poll' && post.quorum_percent ? (
                        <p className="mt-1 text-xs text-subtle">Quórum requerido: {post.quorum_percent}%</p>
                      ) : null}
                      {quorumResult ? (
                        <p
                          className={`mt-1 text-xs font-medium ${
                            quorumResult.statusTone === 'success'
                              ? 'text-emerald-300'
                              : quorumResult.statusTone === 'warning'
                                ? 'text-amber-300'
                                : 'text-subtle'
                          }`}
                        >
                          {quorumResult.statusLabel}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {post.is_pinned && !post.is_archived ? (
                          <button
                            type="button"
                            onClick={() => runAction(() => unpinPost(post.id), 'Desfijado.')}
                            disabled={pending}
                            className="glass-btn-secondary text-xs"
                          >
                            Quitar fijado
                          </button>
                        ) : null}
                        {!post.is_archived ? (
                          <button
                            type="button"
                            onClick={() => runAction(() => archivePost(post.id), 'Archivado.')}
                            disabled={pending}
                            className="glass-btn-secondary text-xs"
                          >
                            Archivar
                          </button>
                        ) : null}
                      </div>
                      {post.post_type === 'poll' && post.poll_options.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                            Resultados · {post.total_votes} voto{post.total_votes === 1 ? '' : 's'}
                          </p>
                          {post.poll_options.map((opt) => {
                            const pct =
                              post.total_votes > 0 ? Math.round((opt.votes / post.total_votes) * 100) : 0;
                            return (
                              <div key={opt.id}>
                                <div className="mb-1 flex items-center justify-between text-sm">
                                  <span className="text-[var(--text)]">{opt.label}</span>
                                  <span className="text-subtle">
                                    {opt.votes} ({pct}%)
                                  </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {!pollClosed ? (
                            <button
                              type="button"
                              onClick={() => runClose(post.id)}
                              disabled={pending}
                              className="glass-btn-secondary mt-2 text-xs"
                            >
                              Cerrar encuesta
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => runAction(() => exportPollResults(post.id), 'Acta exportada.')}
                              disabled={pending}
                              className="glass-btn-secondary mt-2 text-xs"
                            >
                              Exportar acta
                            </button>
                          )}
                        </div>
                      ) : null}
                      {post.comments.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                            Comentarios ({post.comments.length})
                          </p>
                          {flattenCommentTree(buildCommentTree(post.comments)).map(({ comment, depth }) => (
                            <div
                              key={comment.id}
                              className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                              style={{ marginLeft: depth * 16 }}
                            >
                              <div>
                                <p className="text-sm text-[var(--text)]">{comment.body}</p>
                                <p className="text-xs text-subtle">{timeAgo(comment.created_at)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  runAction(() => deleteComment(comment.id), 'Comentario eliminado.')
                                }
                                disabled={pending}
                                className="glass-btn-secondary shrink-0 text-xs text-red-200"
                              >
                                Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          )}

          {message ? (
            <p
              className={`mt-4 text-sm ${
                message.includes('publicad') ||
                message.includes('Archivad') ||
                message.includes('Desfij') ||
                message.includes('export') ||
                message.includes('cerrad') ||
                message.includes('eliminad')
                  ? 'text-accent'
                  : 'text-red-300'
              }`}
            >
              {message}
            </p>
          ) : null}
        </GlassCard>
      ) : tab === 'mi-comunidad' ? (
        <div className="space-y-3">
          <GlassCard>
            <h2 className="text-lg font-semibold text-[var(--text)]">Equipo y comité</h2>
            <p className="mt-1 text-sm text-muted">
              Listado para que residentes vean quién forma la administración. El comité de vigilancia se
              agrega desde el directorio de residentes.
            </p>
            <div className="mt-4">
              <CommunityTeamRoster
                members={directoryRows}
                manualStaff={manualStaff}
                clusterId={selectedClusterId}
                scopeLabel={scopeLabel}
              />
            </div>
          </GlassCard>
          <GlassCard>
            <VigilanceCommitteePanel
              condominiumId={selectedCondoId}
              clusterId={selectedClusterId}
              clusterLabel={scopeLabel}
              residents={scopedResidents}
              members={vigilanceRows}
            />
          </GlassCard>
        </div>
      ) : (
        <AssembliesPanel
          condominiumId={selectedCondoId}
          clusterId={selectedClusterId}
          scopeLabel={scopeLabel}
          assemblies={assemblies}
          posts={posts}
          documents={documents}
          tickets={ticketOptions}
        />
      )}

      {publishOpen && publishTab ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 cursor-default"
            onClick={() => setPublishOpen(false)}
          />
          <GlassCard className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto !p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">{PUBLISH_LABEL[publishTab]}</h3>
                <p className="mt-1 text-xs text-subtle">
                  Se publicará para <span className="font-medium text-[var(--text)]">{scopeLabel}</span>{' '}
                  (según el filtro de la pantalla).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="glass-btn px-3 py-1.5 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>

            {publishTab === 'announcement' ? (
              <form
                action={(fd) => run(createAnnouncement, fd, 'Aviso publicado.')}
                className="space-y-3"
              >
                <PublishScopeFields selectedClusterId={selectedClusterId} />
                <input name="title" required placeholder="Título del aviso" className="glass-input" />
                <textarea
                  name="body"
                  rows={4}
                  placeholder="Contenido (opcional)"
                  className="glass-input min-h-[100px]"
                />
                <FileUpload
                  bucket={STORAGE_BUCKETS.POSTS}
                  buildPath={(ext) => postImagePath(selectedCondoId, crypto.randomUUID(), ext)}
                  inputName="attachment_url"
                  label="Adjunto (opcional)"
                  hint="Imagen o PDF. Máximo 2 MB (imagen) o 5 MB (PDF)."
                  uploadButtonLabel="Subir adjunto"
                />
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="is_pinned" className="rounded border-white/20" />
                  Fijar en la parte superior
                </label>
                <AssemblyPublishSelect assemblies={assemblies} clusterId={selectedClusterId} />
                <button type="submit" disabled={pending} className="glass-btn-primary">
                  {pending ? 'Publicando…' : 'Publicar aviso'}
                </button>
              </form>
            ) : publishTab === 'poll' ? (
              <form action={(fd) => run(createPoll, fd, 'Encuesta publicada.')} className="space-y-3">
                <PublishScopeFields selectedClusterId={selectedClusterId} />
                <input name="title" required placeholder="Pregunta de la encuesta" className="glass-input" />
                <textarea
                  name="body"
                  rows={2}
                  placeholder="Contexto adicional (opcional)"
                  className="glass-input"
                />
                <label className="block text-sm text-muted">
                  Opciones de respuesta (una por línea)
                  <textarea
                    name="options"
                    required
                    rows={4}
                    placeholder={'Opción 1\nOpción 2\nOpción 3'}
                    className="glass-input mt-1 min-h-[100px] font-mono text-sm"
                  />
                </label>

                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-[var(--text)]">Quién puede votar</p>
                  <label className="flex items-start gap-3 text-sm text-muted">
                    <input
                      type="radio"
                      name="require_payment_current"
                      value="off"
                      defaultChecked
                      className="mt-1"
                    />
                    <span>
                      <strong className="text-[var(--text)]">Todos los residentes elegibles</strong> — sin
                      restricción por pagos (sujeto al tipo formal/informal).
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-muted">
                    <input type="radio" name="require_payment_current" value="on" className="mt-1" />
                    <span>
                      <strong className="text-[var(--text)]">Solo al corriente</strong> — unidades con adeudos
                      pendientes no podrán votar y verán una alerta en la app.
                    </span>
                  </label>
                </div>

                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-[var(--text)]">Tipo de votación</p>
                  <label className="flex items-start gap-3 text-sm text-muted">
                    <input type="radio" name="is_formal" value="on" defaultChecked className="mt-1" />
                    <span>
                      <strong className="text-[var(--text)]">Formal</strong> — solo residentes propietarios pueden
                      votar. Ideal para decisiones del condominio.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-muted">
                    <input type="radio" name="is_formal" value="off" className="mt-1" />
                    <span>
                      <strong className="text-[var(--text)]">Informal</strong> — propietarios e inquilinos pueden
                      votar. Ideal para preferencias o encuestas de convivencia.
                    </span>
                  </label>
                </div>

                <label className="block text-sm text-muted">
                  Cierre automático (opcional)
                  <input type="datetime-local" name="poll_closes_at" className="glass-input mt-1" />
                </label>

                <label className="block text-sm text-muted">
                  Quórum formal (opcional, %)
                  <input
                    type="number"
                    name="quorum_percent"
                    min={1}
                    max={100}
                    step={1}
                    placeholder="Ej. 50"
                    className="glass-input mt-1"
                  />
                  <span className="mt-1 block text-xs text-subtle">
                    Solo encuestas formales. Compara participación vs. electores elegibles.
                  </span>
                </label>

                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="is_pinned" className="rounded border-white/20" />
                  Fijar en la parte superior
                </label>

                <AssemblyPublishSelect assemblies={assemblies} clusterId={selectedClusterId} />

                <button type="submit" disabled={pending} className="glass-btn-primary">
                  {pending ? 'Publicando…' : 'Publicar encuesta'}
                </button>
              </form>
            ) : (
              <form
                action={(fd) => run(uploadDocument, fd, 'Documento publicado.')}
                className="space-y-3"
              >
                <PublishScopeFields selectedClusterId={selectedClusterId} />
                <input name="title" required placeholder="Título del documento" className="glass-input" />
                <input
                  name="category"
                  required
                  placeholder="Categoría (ej. Reglamento, Minutas)"
                  className="glass-input"
                />
                <FileUpload
                  bucket={STORAGE_BUCKETS.DOCUMENTS}
                  buildPath={(ext) => documentStoragePath(selectedCondoId, crypto.randomUUID(), ext)}
                  inputName="file_url"
                  label="Archivo"
                  hint="PDF o imagen. Los residentes lo verán en la pestaña Documentos de la app."
                />
                <button type="submit" disabled={pending} className="glass-btn-primary">
                  {pending ? 'Publicando…' : 'Publicar documento'}
                </button>
              </form>
            )}

            {message ? (
              <p
                className={`mt-4 text-sm ${message.includes('publicad') ? 'text-accent' : 'text-red-300'}`}
              >
                {message}
              </p>
            ) : null}
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
