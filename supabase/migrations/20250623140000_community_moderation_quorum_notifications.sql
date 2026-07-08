-- Moderación, quórum en encuestas formales y bandeja de notificaciones in-app.

alter table public.posts
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists quorum_percent numeric(5, 2);

comment on column public.posts.is_archived is
  'Publicación archivada: oculta del feed de residentes.';
comment on column public.posts.archived_at is
  'Fecha de archivado por administración.';
comment on column public.posts.quorum_percent is
  'Encuestas formales: porcentaje mínimo de participación (0–100).';

alter table public.posts
  drop constraint if exists posts_quorum_percent_range;

alter table public.posts
  add constraint posts_quorum_percent_range
  check (quorum_percent is null or (quorum_percent > 0 and quorum_percent <= 100));

create or replace function public.is_poll_open(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        p.post_type = 'poll'
        and not p.is_archived
        and p.poll_closed_at is null
        and (p.poll_closes_at is null or p.poll_closes_at > now())
      from public.posts p
      where p.id = p_post_id
    ),
    false
  );
$$;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'community_poll',
      'community_poll_closed',
      'community_comment',
      'community_announcement'
    )
  ),
  title text not null,
  body text,
  entity_type text not null default 'post',
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications (user_id, created_at desc);

create index if not exists idx_user_notifications_user_unread
  on public.user_notifications (user_id)
  where read_at is null;

alter table public.user_notifications enable row level security;

create policy "Users view own notifications"
on public.user_notifications for select
using (user_id = auth.uid());

create policy "Users mark own notifications read"
on public.user_notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.notify_pinned_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
begin
  select p.id, p.condominium_id, p.title, p.is_pinned
  into v_post
  from public.posts p
  where p.id = new.post_id;

  if not found or not v_post.is_pinned then
    return new;
  end if;

  insert into public.user_notifications (
    condominium_id,
    user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id
  )
  select
    v_post.condominium_id,
    m.user_id,
    'community_comment',
    'Nuevo comentario en aviso fijado',
    left(trim(new.body), 160),
    'post',
    v_post.id
  from public.memberships m
  where m.condominium_id = v_post.condominium_id
    and m.status = 'active'
    and m.user_id <> new.author_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_pinned_post_comment on public.post_comments;

create trigger trg_notify_pinned_post_comment
after insert on public.post_comments
for each row
execute function public.notify_pinned_post_comment();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end $$;
