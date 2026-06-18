-- Recurring periodic fees (maintenance) with amount revision history

create type public.recurring_fee_status as enum ('active', 'paused', 'cancelled');

create table public.recurring_fees (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  cluster_id uuid references public.clusters (id) on delete set null,
  scope public.fee_scope not null check (scope in ('general', 'cluster')),
  concept text not null,
  due_day smallint not null check (due_day between 1 and 28),
  fund_type public.fund_type not null default 'operating',
  status public.recurring_fee_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_fees_cluster_scope check (
    (scope = 'cluster' and cluster_id is not null) or (scope = 'general' and cluster_id is null)
  )
);

create table public.recurring_fee_revisions (
  id uuid primary key default gen_random_uuid(),
  recurring_fee_id uuid not null references public.recurring_fees (id) on delete cascade,
  base_amount numeric(12, 2) not null check (base_amount > 0),
  effective_from date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.charges
  add column recurring_fee_id uuid references public.recurring_fees (id) on delete set null;

create index idx_recurring_fees_condo_status on public.recurring_fees (condominium_id, status);
create index idx_recurring_fee_revisions_fee on public.recurring_fee_revisions (recurring_fee_id, effective_from desc);
create index idx_charges_recurring_fee_period on public.charges (recurring_fee_id, period_month);

create unique index idx_charges_recurring_unit_period
on public.charges (recurring_fee_id, unit_id, period_month)
where recurring_fee_id is not null and period_month is not null;

create trigger recurring_fees_updated_at
before update on public.recurring_fees
for each row execute function public.set_updated_at();

alter table public.recurring_fees enable row level security;
alter table public.recurring_fee_revisions enable row level security;

create policy "Members view recurring fees"
on public.recurring_fees for select
using (public.is_member_of(condominium_id));

create policy "Admins manage recurring fees"
on public.recurring_fees for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view recurring fee revisions"
on public.recurring_fee_revisions for select
using (
  exists (
    select 1 from public.recurring_fees rf
    where rf.id = recurring_fee_id and public.is_member_of(rf.condominium_id)
  )
);

create policy "Admins manage recurring fee revisions"
on public.recurring_fee_revisions for all
using (
  exists (
    select 1 from public.recurring_fees rf
    where rf.id = recurring_fee_id
      and public.has_role(rf.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.recurring_fees rf
    where rf.id = recurring_fee_id
      and public.has_role(rf.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);
