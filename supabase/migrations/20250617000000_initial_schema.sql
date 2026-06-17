-- Veka: initial multi-tenant schema for condominium management

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type public.membership_role as enum (
  'super_admin',
  'admin',
  'board_member',
  'resident',
  'guard',
  'staff'
);

create type public.membership_status as enum ('active', 'inactive');

create type public.charge_status as enum ('pending', 'paid', 'overdue', 'cancelled');

create type public.payment_status as enum ('pending_review', 'approved', 'rejected');

create type public.fund_type as enum ('operating', 'reserve');

create type public.post_type as enum ('announcement', 'poll', 'photo');

create type public.visit_type as enum ('visit', 'service', 'rental');

create type public.package_status as enum ('received', 'delivered', 'returned');

create type public.reservation_status as enum ('confirmed', 'cancelled', 'completed');

-- Core tenant tables
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.condominiums (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  name text not null,
  slug text not null unique,
  address text,
  timezone text not null default 'America/Mexico_City',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clusters (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (condominium_id, name)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  cluster_id uuid references public.clusters (id) on delete set null,
  identifier text not null,
  coefficient numeric(8, 6) not null default 1,
  created_at timestamptz not null default now(),
  unique (condominium_id, identifier)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  role public.membership_role not null default 'resident',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (user_id, condominium_id, unit_id)
);

-- Finance
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  concept text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  fund_type public.fund_type not null default 'operating',
  due_date date not null,
  status public.charge_status not null default 'pending',
  period_month date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges (id) on delete cascade,
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  status public.payment_status not null default 'pending_review',
  proof_url text,
  payment_method text,
  paid_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  cluster_id uuid references public.clusters (id) on delete set null,
  concept text not null,
  amount numeric(12, 2) not null check (amount > 0),
  fund_type public.fund_type not null default 'operating',
  category text not null,
  expense_date date not null default current_date,
  vendor_name text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  file_url text not null,
  file_name text,
  created_at timestamptz not null default now()
);

create table public.fund_balances (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  fund_type public.fund_type not null,
  balance numeric(14, 2) not null default 0,
  as_of_date date not null default current_date,
  unique (condominium_id, fund_type)
);

-- Community
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  cluster_id uuid references public.clusters (id) on delete set null,
  author_id uuid not null references auth.users (id) on delete cascade,
  post_type public.post_type not null default 'announcement',
  title text not null,
  body text,
  image_url text,
  is_pinned boolean not null default false,
  is_admin_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_option_id, user_id)
);

create table public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  cluster_id uuid references public.clusters (id) on delete set null,
  title text not null,
  category text not null,
  file_url text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Amenities & reservations
create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  name text not null,
  description text,
  max_daily_reservations int not null default 1,
  max_monthly_reservations int not null default 4,
  slot_duration_minutes int not null default 60,
  open_time time not null default '08:00',
  close_time time not null default '22:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (condominium_id, name)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  amenity_id uuid not null references public.amenities (id) on delete cascade,
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.reservation_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Security
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  visitor_name text not null,
  visitor_phone text,
  visit_type public.visit_type not null default 'visit',
  vehicle_plate text,
  notes text,
  qr_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  checked_in_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until > valid_from)
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  tracking_number text,
  carrier text,
  photo_url text,
  notes text,
  status public.package_status not null default 'received',
  received_by uuid references auth.users (id) on delete set null,
  delivered_to uuid references auth.users (id) on delete set null,
  received_at timestamptz not null default now(),
  delivered_at timestamptz,
  signature_url text
);

-- Notifications config
create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  rule_key text not null,
  days_before int,
  days_after int,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (condominium_id, rule_key)
);

-- Indexes
create index idx_memberships_user on public.memberships (user_id);
create index idx_memberships_condo on public.memberships (condominium_id);
create index idx_charges_unit_status on public.charges (unit_id, status);
create index idx_charges_condo_due on public.charges (condominium_id, due_date);
create index idx_payments_charge on public.payments (charge_id);
create index idx_expenses_condo_date on public.expenses (condominium_id, expense_date);
create index idx_posts_condo_created on public.posts (condominium_id, created_at desc);
create index idx_reservations_amenity_time on public.reservations (amenity_id, starts_at, ends_at);
create index idx_visits_qr on public.visits (qr_token);
create index idx_packages_unit_status on public.packages (unit_id, status);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger condominiums_updated_at
before update on public.condominiums
for each row execute function public.set_updated_at();

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger charges_updated_at
before update on public.charges
for each row execute function public.set_updated_at();

create trigger posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

-- Auth: auto-create profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS helpers
create or replace function public.is_member_of(condo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.condominium_id = condo_id
      and m.status = 'active'
  );
$$;

create or replace function public.has_role(condo_id uuid, roles public.membership_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.condominium_id = condo_id
      and m.status = 'active'
      and m.role = any (roles)
  );
$$;

create or replace function public.my_unit_ids(condo_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.unit_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.condominium_id = condo_id
    and m.status = 'active'
    and m.unit_id is not null;
$$;

-- Enable RLS
alter table public.organizations enable row level security;
alter table public.condominiums enable row level security;
alter table public.clusters enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_attachments enable row level security;
alter table public.fund_balances enable row level security;
alter table public.posts enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.post_reactions enable row level security;
alter table public.documents enable row level security;
alter table public.amenities enable row level security;
alter table public.reservations enable row level security;
alter table public.visits enable row level security;
alter table public.packages enable row level security;
alter table public.notification_rules enable row level security;

-- Profiles
create policy "Users can view own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
using (id = auth.uid());

-- Memberships
create policy "Members can view memberships in their condominiums"
on public.memberships for select
using (public.is_member_of(condominium_id));

create policy "Admins manage memberships"
on public.memberships for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Condominiums & structure
create policy "Members can view their condominiums"
on public.condominiums for select
using (public.is_member_of(id));

create policy "Admins manage condominiums"
on public.condominiums for all
using (public.has_role(id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view clusters"
on public.clusters for select
using (public.is_member_of(condominium_id));

create policy "Admins manage clusters"
on public.clusters for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view units"
on public.units for select
using (public.is_member_of(condominium_id));

create policy "Admins manage units"
on public.units for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Finance: charges visible to unit members and admins
create policy "Residents view own charges"
on public.charges for select
using (
  public.is_member_of(condominium_id)
  and (
    unit_id in (select public.my_unit_ids(condominium_id))
    or public.has_role(condominium_id, array['super_admin', 'admin', 'board_member']::public.membership_role[])
  )
);

create policy "Admins manage charges"
on public.charges for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Residents view and submit payments"
on public.payments for select
using (
  public.is_member_of(condominium_id)
  and (
    unit_id in (select public.my_unit_ids(condominium_id))
    or public.has_role(condominium_id, array['super_admin', 'admin', 'board_member']::public.membership_role[])
  )
);

create policy "Residents create payments for own units"
on public.payments for insert
with check (
  public.is_member_of(condominium_id)
  and unit_id in (select public.my_unit_ids(condominium_id))
);

create policy "Admins review payments"
on public.payments for update
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view expenses"
on public.expenses for select
using (public.is_member_of(condominium_id));

create policy "Admins manage expenses"
on public.expenses for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view expense attachments"
on public.expense_attachments for select
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_member_of(e.condominium_id)
  )
);

create policy "Admins manage expense attachments"
on public.expense_attachments for all
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and public.has_role(e.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Members view fund balances"
on public.fund_balances for select
using (public.is_member_of(condominium_id));

create policy "Admins manage fund balances"
on public.fund_balances for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Community
create policy "Members view posts"
on public.posts for select
using (public.is_member_of(condominium_id));

create policy "Members and admins create posts"
on public.posts for insert
with check (
  public.is_member_of(condominium_id)
  and (
    author_id = auth.uid()
    and (
      not is_admin_only
      or public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[])
    )
  )
);

create policy "Authors and admins update posts"
on public.posts for update
using (
  public.is_member_of(condominium_id)
  and (
    author_id = auth.uid()
    or public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Members view poll options"
on public.poll_options for select
using (
  exists (
    select 1 from public.posts p
    where p.id = post_id and public.is_member_of(p.condominium_id)
  )
);

create policy "Members vote once"
on public.poll_votes for select
using (user_id = auth.uid());

create policy "Members insert votes"
on public.poll_votes for insert
with check (user_id = auth.uid());

create policy "Members react to posts"
on public.post_reactions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Members view documents"
on public.documents for select
using (public.is_member_of(condominium_id));

create policy "Admins manage documents"
on public.documents for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Amenities
create policy "Members view amenities"
on public.amenities for select
using (public.is_member_of(condominium_id));

create policy "Admins manage amenities"
on public.amenities for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view reservations"
on public.reservations for select
using (public.is_member_of(condominium_id));

create policy "Residents create reservations for own units"
on public.reservations for insert
with check (
  public.is_member_of(condominium_id)
  and user_id = auth.uid()
  and unit_id in (select public.my_unit_ids(condominium_id))
);

create policy "Users manage own reservations"
on public.reservations for update
using (user_id = auth.uid() or public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (user_id = auth.uid() or public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Security
create policy "Residents manage own visits"
on public.visits for select
using (
  public.is_member_of(condominium_id)
  and (
    created_by = auth.uid()
    or public.has_role(condominium_id, array['super_admin', 'admin', 'guard', 'staff']::public.membership_role[])
  )
);

create policy "Residents create visits"
on public.visits for insert
with check (
  public.is_member_of(condominium_id)
  and created_by = auth.uid()
  and unit_id in (select public.my_unit_ids(condominium_id))
);

create policy "Guards check in visits"
on public.visits for update
using (public.has_role(condominium_id, array['super_admin', 'admin', 'guard', 'staff']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin', 'guard', 'staff']::public.membership_role[]));

create policy "Members view packages for their units"
on public.packages for select
using (
  public.is_member_of(condominium_id)
  and (
    unit_id in (select public.my_unit_ids(condominium_id))
    or public.has_role(condominium_id, array['super_admin', 'admin', 'guard', 'staff']::public.membership_role[])
  )
);

create policy "Staff register packages"
on public.packages for insert
with check (public.has_role(condominium_id, array['super_admin', 'admin', 'guard', 'staff']::public.membership_role[]));

create policy "Staff update package delivery"
on public.packages for update
using (public.has_role(condominium_id, array['super_admin', 'admin', 'guard', 'staff']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin', 'guard', 'staff']::public.membership_role[]));

create policy "Admins manage notification rules"
on public.notification_rules for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view notification rules"
on public.notification_rules for select
using (public.is_member_of(condominium_id));

-- Storage buckets (run via supabase storage)
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('payment-proofs', 'payment-proofs', false),
  ('expense-evidence', 'expense-evidence', false),
  ('packages', 'packages', false),
  ('posts', 'posts', false)
on conflict (id) do nothing;
