-- Annual budgets with category lines (expense + income)

create table public.annual_budgets (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  fiscal_year int not null check (fiscal_year >= 2000 and fiscal_year <= 2100),
  fund_type public.fund_type not null default 'operating',
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (condominium_id, fiscal_year, fund_type)
);

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.annual_budgets (id) on delete cascade,
  line_kind text not null check (line_kind in ('expense', 'income')),
  category text not null,
  annual_amount numeric(12, 2) not null check (annual_amount >= 0),
  unique (budget_id, line_kind, category)
);

create index idx_annual_budgets_condo_year on public.annual_budgets (condominium_id, fiscal_year desc);
create index idx_budget_lines_budget on public.budget_lines (budget_id);

alter table public.annual_budgets enable row level security;
alter table public.budget_lines enable row level security;

create policy "Members view annual budgets"
on public.annual_budgets for select
using (public.is_member_of(condominium_id));

create policy "Admins manage annual budgets"
on public.annual_budgets for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view budget lines"
on public.budget_lines for select
using (
  exists (
    select 1 from public.annual_budgets ab
    where ab.id = budget_id and public.is_member_of(ab.condominium_id)
  )
);

create policy "Admins manage budget lines"
on public.budget_lines for all
using (
  exists (
    select 1 from public.annual_budgets ab
    where ab.id = budget_id
      and public.has_role(ab.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1 from public.annual_budgets ab
    where ab.id = budget_id
      and public.has_role(ab.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);
