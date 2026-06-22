-- Payment plans: structured installment agreements against delinquent charges.

create type public.payment_plan_status as enum ('active', 'completed', 'cancelled', 'defaulted');
create type public.installment_status as enum ('pending', 'paid', 'overdue', 'cancelled');

create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  title text not null default 'Plan de pago',
  notes text,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  status public.payment_plan_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payment_plans_condo on public.payment_plans (condominium_id, status);
create index idx_payment_plans_unit on public.payment_plans (unit_id, status);

create table public.payment_plan_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans (id) on delete cascade,
  installment_number int not null check (installment_number > 0),
  due_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  status public.installment_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (plan_id, installment_number),
  check (amount_paid <= amount)
);

create index idx_payment_plan_installments_plan on public.payment_plan_installments (plan_id, due_date);
create index idx_payment_plan_installments_due on public.payment_plan_installments (due_date, status);

create table public.payment_plan_charges (
  plan_id uuid not null references public.payment_plans (id) on delete cascade,
  charge_id uuid not null references public.charges (id) on delete cascade,
  balance_at_start numeric(12, 2) not null check (balance_at_start > 0),
  primary key (plan_id, charge_id)
);

create index idx_payment_plan_charges_charge on public.payment_plan_charges (charge_id);

alter table public.payments
  add column if not exists payment_plan_installment_id uuid references public.payment_plan_installments (id) on delete set null;

create index if not exists idx_payments_plan_installment
  on public.payments (payment_plan_installment_id)
  where payment_plan_installment_id is not null;

-- One active plan per unit.
create unique index idx_payment_plans_one_active_per_unit
  on public.payment_plans (unit_id)
  where status = 'active';

alter table public.payment_plans enable row level security;
alter table public.payment_plan_installments enable row level security;
alter table public.payment_plan_charges enable row level security;

create policy "Members view payment plans"
on public.payment_plans for select
using (
  public.is_member_of(condominium_id)
  and (
    public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[])
    or exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.unit_id = payment_plans.unit_id
        and m.status = 'active'
    )
  )
);

create policy "Admins manage payment plans"
on public.payment_plans for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view plan installments"
on public.payment_plan_installments for select
using (
  exists (
    select 1 from public.payment_plans pp
    where pp.id = payment_plan_installments.plan_id
      and public.is_member_of(pp.condominium_id)
      and (
        public.has_role(pp.condominium_id, array['super_admin', 'admin']::public.membership_role[])
        or exists (
          select 1 from public.memberships m
          where m.user_id = auth.uid() and m.unit_id = pp.unit_id and m.status = 'active'
        )
      )
  )
);

create policy "Admins manage plan installments"
on public.payment_plan_installments for all
using (
  exists (
    select 1 from public.payment_plans pp
    where pp.id = payment_plan_installments.plan_id
      and public.has_role(pp.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.payment_plans pp
    where pp.id = payment_plan_installments.plan_id
      and public.has_role(pp.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Members view plan charge links"
on public.payment_plan_charges for select
using (
  exists (
    select 1 from public.payment_plans pp
    where pp.id = payment_plan_charges.plan_id
      and public.is_member_of(pp.condominium_id)
      and (
        public.has_role(pp.condominium_id, array['super_admin', 'admin']::public.membership_role[])
        or exists (
          select 1 from public.memberships m
          where m.user_id = auth.uid() and m.unit_id = pp.unit_id and m.status = 'active'
        )
      )
  )
);

create policy "Admins manage plan charge links"
on public.payment_plan_charges for all
using (
  exists (
    select 1 from public.payment_plans pp
    where pp.id = payment_plan_charges.plan_id
      and public.has_role(pp.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.payment_plans pp
    where pp.id = payment_plan_charges.plan_id
      and public.has_role(pp.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create or replace function public.refresh_payment_plan_installment_statuses()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  update public.payment_plan_installments pi
  set status = 'overdue'
  from public.payment_plans pp
  where pi.plan_id = pp.id
    and pp.status = 'active'
    and pi.status = 'pending'
    and pi.due_date < current_date
    and pi.amount_paid < pi.amount - 0.01;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.refresh_payment_plan_installment_statuses() to authenticated, service_role;
