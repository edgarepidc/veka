-- Stripe gateway fields, payment allocations, bank reconciliation

alter table public.payments
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists idx_payments_stripe_session
  on public.payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  charge_id uuid not null references public.charges (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, charge_id)
);

create index if not exists idx_payment_allocations_charge on public.payment_allocations (charge_id);

alter table public.payment_allocations enable row level security;

create policy "Members view payment allocations"
on public.payment_allocations for select
using (
  exists (
    select 1 from public.payments p
    join public.memberships m on m.condominium_id = p.condominium_id
    where p.id = payment_allocations.payment_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy "Admins manage payment allocations"
on public.payment_allocations for all
using (
  exists (
    select 1 from public.payments p
    where p.id = payment_allocations.payment_id
      and public.has_role(p.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.payments p
    where p.id = payment_allocations.payment_id
      and public.has_role(p.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  name text not null,
  bank_name text,
  account_last4 text,
  clabe text,
  currency text not null default 'MXN',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  transaction_date date not null,
  amount numeric(14, 2) not null,
  description text,
  reference text,
  external_id text,
  status text not null default 'unmatched'
    check (status in ('unmatched', 'matched', 'ignored')),
  imported_at timestamptz not null default now(),
  unique (bank_account_id, external_id)
);

create index if not exists idx_bank_transactions_account_date
  on public.bank_transactions (bank_account_id, transaction_date desc);

create table if not exists public.bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  bank_transaction_id uuid not null references public.bank_transactions (id) on delete cascade,
  match_type text not null check (match_type in ('payment', 'income', 'expense')),
  payment_id uuid references public.payments (id) on delete set null,
  income_entry_id uuid references public.income_entries (id) on delete set null,
  expense_id uuid references public.expenses (id) on delete set null,
  matched_by uuid references auth.users (id) on delete set null,
  matched_at timestamptz not null default now(),
  unique (bank_transaction_id)
);

alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.bank_reconciliation_matches enable row level security;

create policy "Admins manage bank accounts"
on public.bank_accounts for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Admins manage bank transactions"
on public.bank_transactions for all
using (
  exists (
    select 1 from public.bank_accounts ba
    where ba.id = bank_transactions.bank_account_id
      and public.has_role(ba.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.bank_accounts ba
    where ba.id = bank_transactions.bank_account_id
      and public.has_role(ba.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Admins manage bank reconciliation matches"
on public.bank_reconciliation_matches for all
using (
  exists (
    select 1 from public.bank_transactions bt
    join public.bank_accounts ba on ba.id = bt.bank_account_id
    where bt.id = bank_reconciliation_matches.bank_transaction_id
      and public.has_role(ba.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.bank_transactions bt
    join public.bank_accounts ba on ba.id = bt.bank_account_id
    where bt.id = bank_reconciliation_matches.bank_transaction_id
      and public.has_role(ba.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);
