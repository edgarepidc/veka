-- Partial payments: track amount applied per charge (FIFO within payment group).

alter table public.charges
  add column if not exists amount_paid numeric(12, 2) not null default 0;

alter table public.charges
  drop constraint if exists charges_amount_paid_check;

alter table public.charges
  add constraint charges_amount_paid_check
  check (amount_paid >= 0 and amount_paid <= amount);

-- Backfill from approved payment allocations.
update public.charges c
set amount_paid = sub.total
from (
  select pa.charge_id, round(sum(pa.amount)::numeric, 2) as total
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where p.status = 'approved'
  group by pa.charge_id
) sub
where c.id = sub.charge_id;

-- Legacy full payments without allocation rows.
update public.charges c
set amount_paid = c.amount
where c.status = 'paid'
  and c.amount_paid = 0;
