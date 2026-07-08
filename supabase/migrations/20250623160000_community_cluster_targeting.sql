-- Alcance por cluster(s): general (sin filas) o una o más torres.

create table if not exists public.post_clusters (
  post_id uuid not null references public.posts (id) on delete cascade,
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  primary key (post_id, cluster_id)
);

create table if not exists public.document_clusters (
  document_id uuid not null references public.documents (id) on delete cascade,
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  primary key (document_id, cluster_id)
);

create index if not exists idx_post_clusters_cluster on public.post_clusters (cluster_id);
create index if not exists idx_document_clusters_cluster on public.document_clusters (cluster_id);

insert into public.post_clusters (post_id, cluster_id)
select p.id, p.cluster_id
from public.posts p
where p.cluster_id is not null
on conflict do nothing;

insert into public.document_clusters (document_id, cluster_id)
select d.id, d.cluster_id
from public.documents d
where d.cluster_id is not null
on conflict do nothing;

create or replace function public.member_cluster_ids_for_condo(p_condominium_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct u.cluster_id
  from public.memberships m
  join public.units u on u.id = m.unit_id
  where m.user_id = auth.uid()
    and m.condominium_id = p_condominium_id
    and m.status = 'active'
    and u.cluster_id is not null;
$$;

grant execute on function public.member_cluster_ids_for_condo(uuid) to authenticated;

create or replace function public.post_visible_to_member(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and public.is_member_of(p.condominium_id)
      and (
        public.has_role(
          p.condominium_id,
          array['super_admin', 'admin', 'board_member', 'staff']::public.membership_role[]
        )
        or not exists (
          select 1 from public.post_clusters pc where pc.post_id = p.id
        )
        or exists (
          select 1
          from public.post_clusters pc
          where pc.post_id = p.id
            and pc.cluster_id in (select public.member_cluster_ids_for_condo(p.condominium_id))
        )
      )
  );
$$;

grant execute on function public.post_visible_to_member(uuid) to authenticated;

create or replace function public.document_visible_to_member(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents d
    where d.id = p_document_id
      and public.is_member_of(d.condominium_id)
      and (
        public.has_role(
          d.condominium_id,
          array['super_admin', 'admin', 'board_member', 'staff']::public.membership_role[]
        )
        or not exists (
          select 1 from public.document_clusters dc where dc.document_id = d.id
        )
        or exists (
          select 1
          from public.document_clusters dc
          where dc.document_id = d.id
            and dc.cluster_id in (select public.member_cluster_ids_for_condo(d.condominium_id))
        )
      )
  );
$$;

grant execute on function public.document_visible_to_member(uuid) to authenticated;

drop policy if exists "Members view posts" on public.posts;
create policy "Members view posts"
on public.posts for select
using (public.post_visible_to_member(id));

drop policy if exists "Members view documents" on public.documents;
create policy "Members view documents"
on public.documents for select
using (public.document_visible_to_member(id));

alter table public.post_clusters enable row level security;
alter table public.document_clusters enable row level security;

create policy "Members view post clusters"
on public.post_clusters for select
using (
  exists (
    select 1 from public.posts p
    where p.id = post_id and public.is_member_of(p.condominium_id)
  )
);

create policy "Admins manage post clusters"
on public.post_clusters for all
using (
  exists (
    select 1 from public.posts p
    where p.id = post_id
      and public.has_role(p.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.posts p
    where p.id = post_id
      and public.has_role(p.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Members view document clusters"
on public.document_clusters for select
using (
  exists (
    select 1 from public.documents d
    where d.id = document_id and public.is_member_of(d.condominium_id)
  )
);

create policy "Admins manage document clusters"
on public.document_clusters for all
using (
  exists (
    select 1 from public.documents d
    where d.id = document_id
      and public.has_role(d.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.documents d
    where d.id = document_id
      and public.has_role(d.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);
