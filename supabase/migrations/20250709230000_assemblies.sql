-- Assembly dossiers: link existing posts/documents + agreements checklist → tickets.

create table if not exists public.assemblies (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  title text not null,
  scheduled_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'held', 'closed')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assemblies_condo_scheduled
  on public.assemblies (condominium_id, scheduled_at desc nulls last);

create table if not exists public.assembly_clusters (
  assembly_id uuid not null references public.assemblies (id) on delete cascade,
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  primary key (assembly_id, cluster_id)
);

create index if not exists idx_assembly_clusters_cluster
  on public.assembly_clusters (cluster_id);

create table if not exists public.assembly_posts (
  assembly_id uuid not null references public.assemblies (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  primary key (assembly_id, post_id)
);

create index if not exists idx_assembly_posts_post on public.assembly_posts (post_id);

create table if not exists public.assembly_documents (
  assembly_id uuid not null references public.assemblies (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  primary key (assembly_id, document_id)
);

create index if not exists idx_assembly_documents_document on public.assembly_documents (document_id);

create table if not exists public.assembly_agreements (
  id uuid primary key default gen_random_uuid(),
  assembly_id uuid not null references public.assemblies (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  is_done boolean not null default false,
  ticket_id uuid references public.maintenance_tickets (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_assembly_agreements_assembly
  on public.assembly_agreements (assembly_id, sort_order);

create index if not exists idx_assembly_agreements_ticket
  on public.assembly_agreements (ticket_id)
  where ticket_id is not null;

alter table public.assemblies enable row level security;
alter table public.assembly_clusters enable row level security;
alter table public.assembly_posts enable row level security;
alter table public.assembly_documents enable row level security;
alter table public.assembly_agreements enable row level security;

create or replace function public.assembly_visible_to_member(p_assembly_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assemblies a
    where a.id = p_assembly_id
      and public.is_member_of(a.condominium_id)
      and (
        public.has_role(
          a.condominium_id,
          array['super_admin', 'admin', 'board_member', 'staff']::public.membership_role[]
        )
        or not exists (
          select 1 from public.assembly_clusters ac where ac.assembly_id = a.id
        )
        or exists (
          select 1
          from public.assembly_clusters ac
          where ac.assembly_id = a.id
            and ac.cluster_id in (select public.member_cluster_ids_for_condo(a.condominium_id))
        )
      )
  );
$$;

grant execute on function public.assembly_visible_to_member(uuid) to authenticated;

create policy "Members view assemblies"
on public.assemblies for select
using (public.assembly_visible_to_member(id));

create policy "Admins manage assemblies"
on public.assemblies for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view assembly clusters"
on public.assembly_clusters for select
using (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id and public.is_member_of(a.condominium_id)
  )
);

create policy "Admins manage assembly clusters"
on public.assembly_clusters for all
using (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id
      and public.has_role(a.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id
      and public.has_role(a.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Members view assembly posts"
on public.assembly_posts for select
using (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id and public.assembly_visible_to_member(a.id)
  )
);

create policy "Admins manage assembly posts"
on public.assembly_posts for all
using (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id
      and public.has_role(a.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id
      and public.has_role(a.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Members view assembly documents"
on public.assembly_documents for select
using (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id and public.assembly_visible_to_member(a.id)
  )
);

create policy "Admins manage assembly documents"
on public.assembly_documents for all
using (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id
      and public.has_role(a.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id
      and public.has_role(a.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Members view assembly agreements"
on public.assembly_agreements for select
using (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id and public.assembly_visible_to_member(a.id)
  )
);

create policy "Admins manage assembly agreements"
on public.assembly_agreements for all
using (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id
      and public.has_role(a.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.assemblies a
    where a.id = assembly_id
      and public.has_role(a.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);
