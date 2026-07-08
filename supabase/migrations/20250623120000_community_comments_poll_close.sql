-- Poll close dates and comments on announcements.

alter table public.posts
  add column if not exists poll_closes_at timestamptz,
  add column if not exists poll_closed_at timestamptz;

comment on column public.posts.poll_closes_at is
  'Encuestas: fecha límite automática para votar (opcional).';
comment on column public.posts.poll_closed_at is
  'Encuestas: cierre manual por administración.';

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
        and p.poll_closed_at is null
        and (p.poll_closes_at is null or p.poll_closes_at > now())
      from public.posts p
      where p.id = p_post_id
    ),
    false
  );
$$;

grant execute on function public.is_poll_open(uuid) to authenticated;

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_post_comments_post_created
  on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

create policy "Members view post comments"
on public.post_comments for select
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_id
      and public.is_member_of(p.condominium_id)
  )
);

create policy "Members comment on announcements"
on public.post_comments for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_id
      and p.post_type in ('announcement', 'photo')
      and public.is_member_of(p.condominium_id)
  )
);

create policy "Authors and admins delete comments"
on public.post_comments for delete
using (
  author_id = auth.uid()
  or exists (
    select 1
    from public.posts p
    where p.id = post_id
      and public.has_role(p.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

drop policy if exists "Residents vote in polls by occupancy" on public.poll_votes;

create policy "Residents vote in polls by occupancy"
on public.poll_votes for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    join public.posts p on p.id = po.post_id
    join public.memberships m
      on m.user_id = auth.uid()
      and m.condominium_id = p.condominium_id
      and m.status = 'active'
    where po.id = poll_option_id
      and public.is_poll_open(p.id)
      and (
        p.is_formal = false
        or m.unit_relationship is null
        or m.unit_relationship = 'owner'
      )
      and (
        p.require_payment_current = false
        or m.unit_id is null
        or not public.unit_has_delinquent_charges(m.unit_id)
      )
  )
);

do $$
begin
  alter publication supabase_realtime add table public.post_comments;
exception
  when duplicate_object then null;
end $$;
