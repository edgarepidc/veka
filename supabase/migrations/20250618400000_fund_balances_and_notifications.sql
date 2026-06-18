-- Auto-reconciled fund balances, push tokens, and notification delivery log

alter table public.notification_rules
  add column if not exists notify_push boolean not null default true,
  add column if not exists notify_email boolean not null default true;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text,
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_push_tokens_user on public.push_tokens (user_id);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  charge_id uuid references public.charges (id) on delete set null,
  channel text not null check (channel in ('push', 'email')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  message text,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists idx_notification_deliveries_charge on public.notification_deliveries (charge_id, sent_at desc);
create index if not exists idx_notification_deliveries_condo on public.notification_deliveries (condominium_id, sent_at desc);

alter table public.push_tokens enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "Users manage own push tokens"
on public.push_tokens for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Admins view notification deliveries"
on public.notification_deliveries for select
using (
  exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.condominium_id = notification_deliveries.condominium_id
      and m.role in ('admin', 'super_admin')
  )
);

create policy "Service role manages notification deliveries"
on public.notification_deliveries for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Reconcile fund balance = approved payment income + manual income - paid expenses (per fund)
create or replace function public.reconcile_condominium_fund_balances(p_condominium_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ft public.fund_type;
  v_income numeric(14, 2);
  v_expense numeric(14, 2);
begin
  for ft in select unnest(enum_range(null::public.fund_type)) loop
    select
      coalesce((
        select sum(p.amount)
        from public.payments p
        join public.charges c on c.id = p.charge_id
        where p.condominium_id = p_condominium_id
          and p.status = 'approved'
          and c.fund_type = ft
      ), 0)
      + coalesce((
        select sum(ie.amount)
        from public.income_entries ie
        where ie.condominium_id = p_condominium_id
          and ie.fund_type = ft
      ), 0)
    into v_income;

    select coalesce(sum(e.amount), 0)
    into v_expense
    from public.expenses e
    where e.condominium_id = p_condominium_id
      and e.status = 'paid'
      and e.fund_type = ft;

    insert into public.fund_balances (condominium_id, fund_type, balance, as_of_date)
    values (p_condominium_id, ft, v_income - v_expense, current_date)
    on conflict (condominium_id, fund_type)
    do update set
      balance = excluded.balance,
      as_of_date = excluded.as_of_date;
  end loop;
end;
$$;

create or replace function public.reconcile_all_fund_balances()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  condo record;
  count int := 0;
begin
  for condo in select id from public.condominiums loop
    perform public.reconcile_condominium_fund_balances(condo.id);
    count := count + 1;
  end loop;
  return count;
end;
$$;

grant execute on function public.reconcile_condominium_fund_balances(uuid) to authenticated, service_role;
grant execute on function public.reconcile_all_fund_balances() to service_role;
