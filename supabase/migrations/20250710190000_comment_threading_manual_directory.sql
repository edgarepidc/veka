-- Threaded comments (max 5 levels) and manual directory entries without platform users.

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments (id) on delete cascade;

create index if not exists idx_post_comments_parent
  on public.post_comments (parent_id);

create or replace function public.post_comment_depth(p_comment_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select id, parent_id, 1 as depth
    from public.post_comments
    where id = p_comment_id
    union all
    select c.id, c.parent_id, chain.depth + 1
    from public.post_comments c
    inner join chain on c.id = chain.parent_id
  )
  select coalesce(max(depth), 0) from chain;
$$;

create or replace function public.post_comment_can_reply(p_parent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent_id is null or public.post_comment_depth(p_parent_id) < 5;
$$;

grant execute on function public.post_comment_depth(uuid) to authenticated;
grant execute on function public.post_comment_can_reply(uuid) to authenticated;

drop policy if exists "Members comment on announcements" on public.post_comments;

create policy "Members comment on announcements"
on public.post_comments for insert
with check (
  author_id = auth.uid()
  and (
    parent_id is null
    or (
      exists (
        select 1
        from public.post_comments parent
        where parent.id = parent_id
          and parent.post_id = post_id
      )
      and public.post_comment_can_reply(parent_id)
    )
  )
  and exists (
    select 1
    from public.posts p
    where p.id = post_id
      and p.post_type in ('announcement', 'photo')
      and public.is_member_of(p.condominium_id)
  )
);

create table if not exists public.directory_manual_entries (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  entry_kind text not null check (entry_kind in ('staff', 'committee')),
  staff_section_id text check (staff_section_id in ('administrative', 'maintenance', 'security')),
  committee_title text,
  role_label text,
  full_name text not null check (char_length(trim(full_name)) > 0),
  phone text,
  unit_identifier text,
  cluster_id uuid references public.clusters (id) on delete set null,
  show_phone boolean not null default true,
  created_at timestamptz not null default now(),
  constraint directory_manual_staff_check check (
    entry_kind = 'committee'
    or (entry_kind = 'staff' and staff_section_id is not null)
  ),
  constraint directory_manual_committee_check check (
    entry_kind = 'staff'
    or (entry_kind = 'committee' and committee_title is not null and char_length(trim(committee_title)) > 0)
  )
);

create index if not exists idx_directory_manual_condo_kind
  on public.directory_manual_entries (condominium_id, entry_kind);

alter table public.directory_manual_entries enable row level security;

create policy "Members view manual directory entries"
on public.directory_manual_entries for select
using (public.is_member_of(condominium_id));

create policy "Admins manage manual directory entries"
on public.directory_manual_entries for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));
