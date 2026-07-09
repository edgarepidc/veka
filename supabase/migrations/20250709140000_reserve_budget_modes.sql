-- Reserve fund budget modes: percent of operating income or component-based lines

alter table public.annual_budgets
  add column if not exists reserve_mode text
    check (reserve_mode is null or reserve_mode in ('percent', 'components')),
  add column if not exists reserve_percent numeric(5, 2)
    check (reserve_percent is null or (reserve_percent >= 0 and reserve_percent <= 100)),
  add column if not exists reserve_income_base text
    check (reserve_income_base is null or reserve_income_base in ('total', 'fees'));

comment on column public.annual_budgets.reserve_mode is
  'For fund_type=reserve: percent = % of operating income; components = manual capital lines.';
comment on column public.annual_budgets.reserve_percent is
  'Annual reserve contribution as % of operating income (percent mode).';
comment on column public.annual_budgets.reserve_income_base is
  'Operating income base: total = all income lines; fees = cuotas category only.';
