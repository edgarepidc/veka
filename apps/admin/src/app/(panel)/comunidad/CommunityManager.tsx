'use client';

import { useState, useTransition } from 'react';

import { GlassCard } from '@/components/ui/GlassCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HELP } from '@/lib/help-content';
import type { CommunityPostRow } from '@/lib/load-community';

import { createAnnouncement, createPoll } from './actions';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function CommunityManager({ posts }: { posts: CommunityPostRow[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<'announcement' | 'poll'>('announcement');

  function run(action: (formData: FormData) => Promise<{ error?: string; success?: boolean }>, formData: FormData, ok: string) {
    setMessage(null);
    start(async () => {
      const result = await action(formData);
      setMessage(result.error ?? ok);
    });
  }

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('announcement')}
            className={`glass-tab ${tab === 'announcement' ? 'glass-tab-active' : ''}`}
          >
            Aviso
          </button>
          <button
            type="button"
            onClick={() => setTab('poll')}
            className={`glass-tab ${tab === 'poll' ? 'glass-tab-active' : ''}`}
          >
            Encuesta
          </button>
        </div>

        {tab === 'announcement' ? (
          <form action={(fd) => run(createAnnouncement, fd, 'Aviso publicado.')} className="space-y-3">
            <input name="title" required placeholder="Título del aviso" className="glass-input" />
            <textarea name="body" rows={4} placeholder="Contenido (opcional)" className="glass-input min-h-[100px]" />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="is_pinned" className="rounded border-white/20" />
              Fijar en la parte superior
            </label>
            <button type="submit" disabled={pending} className="glass-btn-primary">
              {pending ? 'Publicando…' : 'Publicar aviso'}
            </button>
          </form>
        ) : (
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

            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="is_pinned" className="rounded border-white/20" />
              Fijar en la parte superior
            </label>

            <button type="submit" disabled={pending} className="glass-btn-primary">
              {pending ? 'Publicando…' : 'Publicar encuesta'}
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
        <SectionHeading help={HELP.comunidad.avisos}>Publicaciones recientes</SectionHeading>
        <ul className="mt-4 space-y-3">
          {posts.length === 0 ? (
            <li className="text-sm text-subtle">No hay publicaciones todavía.</li>
          ) : (
            posts.map((post) => (
              <li key={post.id} className="glass-card-deep px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="glass-tag-blue text-[10px]">
                    {post.post_type === 'poll' ? 'Encuesta' : 'Aviso'}
                  </span>
                  {post.post_type === 'poll' ? (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${post.is_formal ? 'text-amber-200' : 'text-sky-200'}`}
                    >
                      {post.is_formal ? 'Formal' : 'Informal'}
                    </span>
                  ) : null}
                  {post.is_pinned ? <span className="text-[10px] text-accent">Fijado</span> : null}
                  <span className="text-xs text-subtle">{timeAgo(post.created_at)}</span>
                </div>
                <p className="mt-2 font-medium text-[var(--text)]">{post.title}</p>
                {post.body ? <p className="mt-1 text-sm text-muted">{post.body}</p> : null}
                {post.poll_options.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-subtle">
                    {post.poll_options.map((opt) => (
                      <li key={opt.id}>· {opt.label}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </GlassCard>
    </div>
  );
}
