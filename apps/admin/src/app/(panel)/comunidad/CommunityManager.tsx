'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import { documentStoragePath, computePollQuorumResult, formatClusterScopeLabel, isImageStoragePath, isPollClosed, pollCloseLabel, postImagePath, STORAGE_BUCKETS } from '@veka/shared';

import { ClusterTargetPicker } from '@/components/ClusterTargetPicker';

import { GlassCard } from '@/components/ui/GlassCard';
import { FileUpload } from '@/components/ui/FileUpload';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HELP } from '@/lib/help-content';
import { createClient } from '@/lib/supabase/client';
import type { CommunityDocumentRow, CommunityPostRow } from '@/lib/load-community';
import type { ClusterOption } from '@/lib/community-clusters';

import { createAnnouncement, archivePost, closePoll, createPoll, deleteComment, exportPollResults, unpinPost, uploadDocument } from './actions';

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
      📄 Ver PDF adjunto
    </a>
  );
}

type CreateTab = 'announcement' | 'poll' | 'document';
type ListFilter = CreateTab;
type PeriodFilter = 'month' | 'quarter' | 'all';

const LIST_FILTER_LABELS: Record<ListFilter, string> = {
  announcement: 'Avisos',
  poll: 'Encuestas',
  document: 'Documentos',
};

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

export function CommunityManager({
  posts,
  documents,
  condominiumId,
  clusters,
}: {
  posts: CommunityPostRow[];
  documents: CommunityDocumentRow[];
  condominiumId: string;
  clusters: ClusterOption[];
}) {
  const supabase = createClient();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<CreateTab>('announcement');
  const [listFilter, setListFilter] = useState<ListFilter>('announcement');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');

  const filteredPosts = useMemo(() => {
    const byType =
      listFilter === 'announcement'
        ? posts.filter(isAnnouncementPost)
        : listFilter === 'poll'
          ? posts.filter((post) => post.post_type === 'poll')
          : [];

    return byType.filter((post) => isInPeriod(post.created_at, periodFilter));
  }, [listFilter, periodFilter, posts]);

  const filteredDocuments = useMemo(
    () => documents.filter((doc) => isInPeriod(doc.created_at, periodFilter)),
    [documents, periodFilter],
  );

  function selectCreateTab(next: CreateTab) {
    setTab(next);
    setListFilter(next);
  }

  function runAction(action: () => Promise<{ error?: string; success?: boolean; message?: string; text?: string }>, ok: string) {
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

  function run(action: (formData: FormData) => Promise<{ error?: string; success?: boolean; message?: string }>, formData: FormData, ok: string) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? result.message ?? ok);
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
    <div className="space-y-6">
      <GlassCard>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectCreateTab('announcement')}
            className={`glass-tab ${tab === 'announcement' ? 'glass-tab-active' : ''}`}
          >
            Aviso
          </button>
          <button
            type="button"
            onClick={() => selectCreateTab('poll')}
            className={`glass-tab ${tab === 'poll' ? 'glass-tab-active' : ''}`}
          >
            Encuesta
          </button>
          <button
            type="button"
            onClick={() => selectCreateTab('document')}
            className={`glass-tab ${tab === 'document' ? 'glass-tab-active' : ''}`}
          >
            Documento
          </button>
        </div>

        {tab === 'announcement' ? (
          <form action={(fd) => run(createAnnouncement, fd, 'Aviso publicado.')} className="space-y-3">
            <input name="title" required placeholder="Título del aviso" className="glass-input" />
            <textarea name="body" rows={4} placeholder="Contenido (opcional)" className="glass-input min-h-[100px]" />
            <FileUpload
              bucket={STORAGE_BUCKETS.POSTS}
              buildPath={(ext) => postImagePath(condominiumId, crypto.randomUUID(), ext)}
              inputName="attachment_url"
              label="Adjunto (opcional)"
              hint="Imagen o PDF. Máximo 2 MB (imagen) o 5 MB (PDF)."
              uploadButtonLabel="Subir adjunto"
            />
            <ClusterTargetPicker clusters={clusters} />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="is_pinned" className="rounded border-white/20" />
              Fijar en la parte superior
            </label>
            <button type="submit" disabled={pending} className="glass-btn-primary">
              {pending ? 'Publicando…' : 'Publicar aviso'}
            </button>
          </form>
        ) : tab === 'poll' ? (
          <form action={(fd) => run(createPoll, fd, 'Encuesta publicada.')} className="space-y-3">
            <input name="title" required placeholder="Pregunta de la encuesta" className="glass-input" />
            <textarea name="body" rows={2} placeholder="Contexto adicional (opcional)" className="glass-input" />
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

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <p className="text-sm font-medium text-[var(--text)]">Quién puede votar</p>
              <label className="flex items-start gap-3 text-sm text-muted">
                <input type="radio" name="require_payment_current" value="off" defaultChecked className="mt-1" />
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

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
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

            <ClusterTargetPicker clusters={clusters} />

            <button type="submit" disabled={pending} className="glass-btn-primary">
              {pending ? 'Publicando…' : 'Publicar encuesta'}
            </button>
          </form>
        ) : (
          <form action={(fd) => run(uploadDocument, fd, 'Documento publicado.')} className="space-y-3">
            <input name="title" required placeholder="Título del documento" className="glass-input" />
            <input name="category" required placeholder="Categoría (ej. Reglamento, Minutas)" className="glass-input" />
            <FileUpload
              bucket={STORAGE_BUCKETS.DOCUMENTS}
              buildPath={(ext) => documentStoragePath(condominiumId, crypto.randomUUID(), ext)}
              inputName="file_url"
              label="Archivo"
              hint="PDF o imagen. Los residentes lo verán en la pestaña Documentos de la app."
            />
            <ClusterTargetPicker clusters={clusters} />
            <button type="submit" disabled={pending} className="glass-btn-primary">
              {pending ? 'Publicando…' : 'Publicar documento'}
            </button>
          </form>
        )}

        {message ? (
          <p className={`mt-4 text-sm ${message.includes('publicad') ? 'text-accent' : 'text-red-300'}`}>
            {message}
          </p>
        ) : null}
      </GlassCard>

      <GlassCard>
        <SectionHeading help={HELP.comunidad.avisos}>Publicaciones del condominio</SectionHeading>

        <div className="glass-tab-strip mb-3">
          {(Object.keys(LIST_FILTER_LABELS) as ListFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setListFilter(key)}
              className={`glass-tab ${listFilter === key ? 'glass-tab-active' : ''}`}
            >
              {LIST_FILTER_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="glass-tab-strip mb-4">
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
          {listFilter === 'document'
            ? `${filteredDocuments.length} documento${filteredDocuments.length === 1 ? '' : 's'} · ${PERIOD_FILTER_LABELS[periodFilter].toLowerCase()}`
            : `${filteredPosts.length} ${LIST_FILTER_LABELS[listFilter].toLowerCase()} · ${PERIOD_FILTER_LABELS[periodFilter].toLowerCase()}`}
        </p>

        {listFilter === 'document' ? (
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
              <li key={post.id} className={`glass-card-deep px-4 py-3 ${post.is_archived ? 'opacity-60' : ''}`}>
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
                      className={`text-[10px] font-semibold uppercase tracking-wide ${post.is_formal ? 'text-amber-200' : 'text-sky-200'}`}
                    >
                      {post.is_formal ? 'Formal' : 'Informal'}
                    </span>
                  ) : null}
                  {post.post_type === 'poll' && post.require_payment_current ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
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
                {post.image_url ? (
                  <PostAttachmentPreview path={post.image_url} />
                ) : null}
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
                      const pct = post.total_votes > 0 ? Math.round((opt.votes / post.total_votes) * 100) : 0;
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
                    {post.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm text-[var(--text)]">{comment.body}</p>
                          <p className="text-xs text-subtle">{timeAgo(comment.created_at)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => runAction(() => deleteComment(comment.id), 'Comentario eliminado.')}
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
      </GlassCard>
    </div>
  );
}
