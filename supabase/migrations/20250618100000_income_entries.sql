-- Manual income entries (non-payment ingresos) with optional cluster scope

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  cluster_id uuid references public.clusters (id) on delete set null,
  concept text not null,
  amount numeric(12, 2) not null check (amount > 0),
  fund_type public.fund_type not null default 'operating',
  category text not null default 'otros',
  income_date date not null default current_date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_income_entries_condo_date on public.income_entries (condominium_id, income_date desc);
create index idx_income_entries_cluster on public.income_entries (cluster_id);

alter table public.income_entries enable row level security;

create policy "Members view income entries"
on public.income_entries for select
using (public.is_member_of(condominium_id));

create policy "Admins manage income entries"
on public.income_entries for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));
