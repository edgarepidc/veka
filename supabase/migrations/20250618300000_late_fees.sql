-- Optional late fees (recargos por mora) and payment reminder log

create table public.late_fee_settings (
  condominium_id uuid primary key references public.condominiums (id) on delete cascade,
  enabled boolean not null default false,
  grace_days int not null default 0 check (grace_days >= 0),
  fee_type text not null default 'fixed' check (fee_type in ('fixed', 'percent')),
  fee_value numeric(12, 2) not null default 0 check (fee_value >= 0),
  apply_mode text not null default 'once' check (apply_mode in ('once', 'monthly')),
  fund_type public.fund_type not null default 'operating',
  notes text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.charges
  add column if not exists parent_charge_id uuid references public.charges (id) on delete cascade,
  add column if not exists charge_kind text not null default 'principal'
    check (charge_kind in ('principal', 'late_fee'));

create index if not exists idx_charges_parent on public.charges (parent_charge_id);
create index if not exists idx_charges_kind_status on public.charges (condominium_id, charge_kind, status);

create unique index if not exists idx_charges_late_fee_period
on public.charges (parent_charge_id, period_month)
where charge_kind = 'late_fee' and parent_charge_id is not null;

create table public.payment_reminder_log (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  charge_id uuid references public.charges (id) on delete set null,
  channel text not null default 'manual' check (channel in ('manual', 'push', 'email')),
  message text,
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now()
);

create index idx_payment_reminder_log_charge on public.payment_reminder_log (charge_id, sent_at desc);
create index idx_payment_reminder_log_unit on public.payment_reminder_log (unit_id, sent_at desc);

alter table public.late_fee_settings enable row level security;
alter table public.payment_reminder_log enable row level security;

create policy "Members view late fee settings"
on public.late_fee_settings for select
using (public.is_member_of(condominium_id));

create policy "Admins manage late fee settings"
on public.late_fee_settings for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Admins view payment reminders"
on public.payment_reminder_log for select
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Admins send payment reminders"
on public.payment_reminder_log for insert
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Default: late fees disabled until admin configures them
insert into public.late_fee_settings (condominium_id, enabled, grace_days, fee_type, fee_value, apply_mode)
values ('22222222-2222-2222-2222-222222222222', false, 15, 'fixed', 500.00, 'once')
on conflict (condominium_id) do nothing;
