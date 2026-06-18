-- Fee campaigns: cuotas issued at general, cluster, or extraordinary scope

create type public.fee_scope as enum ('general', 'cluster', 'extraordinary');

create type public.fee_campaign_status as enum ('active', 'cancelled');

create table public.fee_campaigns (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  cluster_id uuid references public.clusters (id) on delete set null,
  scope public.fee_scope not null,
  concept text not null,
  amount numeric(12, 2) not null check (amount > 0),
  fund_type public.fund_type not null default 'operating',
  due_date date not null,
  period_month date,
  status public.fee_campaign_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.charges
  add column fee_campaign_id uuid references public.fee_campaigns (id) on delete set null;

create index idx_fee_campaigns_condo_status on public.fee_campaigns (condominium_id, status);
create index idx_charges_fee_campaign on public.charges (fee_campaign_id);

create trigger fee_campaigns_updated_at
before update on public.fee_campaigns
for each row execute function public.set_updated_at();

alter table public.fee_campaigns enable row level security;

create policy "Members view fee campaigns"
on public.fee_campaigns for select
using (public.is_member_of(condominium_id));

create policy "Admins manage fee campaigns"
on public.fee_campaigns for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));
