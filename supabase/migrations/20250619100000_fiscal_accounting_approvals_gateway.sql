-- CFDI, accounting export maps, dual approval, and async gateway payments (Oxxo/SPEI).

alter type public.payment_status add value if not exists 'pending_second_review';
alter type public.payment_status add value if not exists 'awaiting_payment';

alter table public.payments
  add column if not exists first_reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists first_reviewed_at timestamptz,
  add column if not exists gateway_method text,
  add column if not exists gateway_reference text,
  add column if not exists gateway_expires_at timestamptz,
  add column if not exists gateway_status text;

create index if not exists idx_payments_gateway_status
  on public.payments (gateway_status)
  where gateway_status is not null;

-- Fiscal emisor (condominio)
create table if not exists public.fiscal_profiles (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null unique references public.condominiums (id) on delete cascade,
  legal_name text not null,
  rfc text not null,
  tax_regime text not null,
  postal_code text not null,
  pac_provider text not null default 'facturapi',
  pac_organization_id text,
  default_series text not null default 'A',
  auto_invoice_on_approve boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Receptor fiscal por unidad
create table if not exists public.unit_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null unique references public.units (id) on delete cascade,
  rfc text not null,
  legal_name text not null,
  tax_regime text,
  postal_code text not null,
  cfdi_use text not null default 'D10',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cfdi_invoices (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  unit_id uuid references public.units (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'stamped', 'cancelled', 'error')),
  uuid_fiscal text,
  series text,
  folio text,
  subtotal numeric(12, 2) not null default 0,
  iva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  xml_url text,
  pdf_url text,
  pac_payload jsonb,
  error_message text,
  stamped_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cfdi_invoices_payment on public.cfdi_invoices (payment_id);
create index if not exists idx_cfdi_invoices_condo on public.cfdi_invoices (condominium_id, created_at desc);

-- Mapeo categorías Veka → cuentas contables
create table if not exists public.accounting_category_maps (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  movement_type text not null check (movement_type in ('income', 'expense')),
  veka_category text not null,
  account_code text not null,
  account_name text,
  fund_type public.fund_type,
  created_at timestamptz not null default now(),
  unique (condominium_id, movement_type, veka_category, fund_type)
);

create index if not exists idx_accounting_maps_condo
  on public.accounting_category_maps (condominium_id, movement_type);

alter table public.fiscal_profiles enable row level security;
alter table public.unit_tax_profiles enable row level security;
alter table public.cfdi_invoices enable row level security;
alter table public.accounting_category_maps enable row level security;

create policy "Admins manage fiscal profiles"
on public.fiscal_profiles for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Admins manage unit tax profiles"
on public.unit_tax_profiles for all
using (
  exists (
    select 1 from public.units u
    where u.id = unit_tax_profiles.unit_id
      and public.has_role(u.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.units u
    where u.id = unit_tax_profiles.unit_id
      and public.has_role(u.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);

create policy "Admins manage cfdi invoices"
on public.cfdi_invoices for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Residents view own cfdi invoices"
on public.cfdi_invoices for select
using (
  unit_id is not null
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.unit_id = cfdi_invoices.unit_id
      and m.status = 'active'
  )
);

create policy "Admins manage accounting category maps"
on public.accounting_category_maps for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));
