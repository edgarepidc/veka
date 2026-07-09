-- Independent annual budgets per cluster (nullable cluster_id = condominio general)

alter table public.annual_budgets
  add column if not exists cluster_id uuid references public.clusters (id) on delete cascade;

alter table public.annual_budgets
  drop constraint if exists annual_budgets_condominium_id_fiscal_year_fund_type_key;

alter table public.annual_budgets
  add column if not exists budget_scope_key uuid generated always as (
    coalesce(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored;

create unique index if not exists annual_budgets_scope_unique
  on public.annual_budgets (condominium_id, fiscal_year, fund_type, budget_scope_key);

create index if not exists idx_annual_budgets_cluster
  on public.annual_budgets (cluster_id)
  where cluster_id is not null;
