-- Classify expenses (supplier, payroll) and track payment status for payables

create type public.expense_kind as enum ('general', 'supplier', 'payroll');
create type public.expense_status as enum ('pending', 'paid');

alter table public.expenses
  add column expense_kind public.expense_kind not null default 'general',
  add column status public.expense_status not null default 'paid';

update public.expenses
set expense_kind = 'supplier'
where vendor_name is not null and expense_kind = 'general';

create index idx_expenses_condo_kind_status on public.expenses (condominium_id, expense_kind, status);
