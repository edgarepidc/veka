'use client';

import { useMemo } from 'react';
import {
  computePollQuorumResult,
  isImageStoragePath,
  isPollClosed,
  pollCloseLabel,
  STORAGE_BUCKETS,
} from '@veka/shared';

import { createClient } from '@/lib/supabase/client';
import type { CommunityPostRow } from '@/lib/load-community';

function postTypeLabel(type: string): string {
  if (type === 'poll') return 'Encuesta';
  if (type === 'photo') return 'Aviso (foto)';
  return 'Aviso';
}

export function AssemblyLinkedPostCard({
  post,
  onRemove,
  removing,
}: {
  post: CommunityPostRow;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
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

  async function openAttachment() {
    if (!post.image_url) return;
    if (post.image_url.startsWith('http://') || post.image_url.startsWith('https://')) {
      window.open(post.image_url, '_blank');
      return;
    }
    const bucket = isImageStoragePath(post.image_url) ? STORAGE_BUCKETS.POSTS : STORAGE_BUCKETS.DOCUMENTS;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(post.image_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <li className="glass-card-deep space-y-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text)]">{post.title}</p>
          <p className="text-xs text-subtle">{postTypeLabel(post.post_type)}</p>
        </div>
        {onRemove ? (
          <button
            type="button"
            disabled={removing}
            onClick={onRemove}
            className="glass-btn shrink-0 px-2 py-1 text-xs"
          >
            Quitar
          </button>
        ) : null}
      </div>

      {post.body ? <p className="text-sm text-muted whitespace-pre-wrap">{post.body}</p> : null}

      {post.image_url ? (
        <button
          type="button"
          onClick={() => void openAttachment()}
          className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
        >
          Ver adjunto
        </button>
      ) : null}

      {post.post_type === 'poll' && post.poll_options.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Resultados · {post.total_votes} voto{post.total_votes === 1 ? '' : 's'}
            {pollClosed ? ` · ${closeLabel ?? 'Cerrada'}` : closeLabel ? ` · ${closeLabel}` : ' · Abierta'}
          </p>
          {quorumResult ? (
            <p
              className={`text-xs ${
                quorumResult.statusTone === 'success'
                  ? 'text-emerald-300'
                  : quorumResult.statusTone === 'warning'
                    ? 'text-amber-200'
                    : 'text-subtle'
              }`}
            >
              {quorumResult.statusLabel}
            </p>
          ) : null}
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
        </div>
      ) : null}
    </li>
  );
}
