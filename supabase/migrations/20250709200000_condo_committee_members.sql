-- Resident committees (e.g. comité de vigilancia) — not staff/security roles.
create table if not exists public.condo_committee_members (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  committee_kind text not null check (committee_kind in ('vigilance')),
  title text not null,
  created_at timestamptz not null default now(),
  unique (condominium_id, membership_id, committee_kind)
);

create index if not exists idx_condo_committee_condo_kind
  on public.condo_committee_members (condominium_id, committee_kind);

alter table public.condo_committee_members enable row level security;

create policy "Members can view condo committee members"
on public.condo_committee_members for select
using (public.is_member_of(condominium_id));

create policy "Admins manage condo committee members"
on public.condo_committee_members for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));
