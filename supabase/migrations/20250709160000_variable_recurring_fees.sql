-- Variable / consumption recurring fees (e.g. centralized gas) with per-unit monthly amounts

alter table public.recurring_fees
  add column if not exists amount_mode text not null default 'fixed'
    check (amount_mode in ('fixed', 'variable'));

comment on column public.recurring_fees.amount_mode is
  'fixed = base_amount × coefficient each month; variable = admin captures per-unit amounts each period.';

create table if not exists public.recurring_fee_period_amounts (
  id uuid primary key default gen_random_uuid(),
  recurring_fee_id uuid not null references public.recurring_fees (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  period_month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurring_fee_id, unit_id, period_month)
);

create index if not exists idx_recurring_fee_period_amounts_fee_period
  on public.recurring_fee_period_amounts (recurring_fee_id, period_month);

create trigger recurring_fee_period_amounts_updated_at
before update on public.recurring_fee_period_amounts
for each row execute function public.set_updated_at();

alter table public.recurring_fee_period_amounts enable row level security;

create policy "Members view recurring fee period amounts"
on public.recurring_fee_period_amounts for select
using (
  exists (
    select 1 from public.recurring_fees rf
    where rf.id = recurring_fee_id and public.is_member_of(rf.condominium_id)
  )
);

create policy "Admins manage recurring fee period amounts"
on public.recurring_fee_period_amounts for all
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
