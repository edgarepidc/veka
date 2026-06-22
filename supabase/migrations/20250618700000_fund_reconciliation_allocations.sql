-- Reconcile fund balances using payment_allocations when present (principal + late fees may differ by fund).
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
        select sum(pa.amount)
        from public.payment_allocations pa
        join public.payments p on p.id = pa.payment_id
        join public.charges c on c.id = pa.charge_id
        where p.condominium_id = p_condominium_id
          and p.status = 'approved'
          and c.fund_type = ft
      ), 0)
      + coalesce((
        select sum(p.amount)
        from public.payments p
        join public.charges c on c.id = p.charge_id
        where p.condominium_id = p_condominium_id
          and p.status = 'approved'
          and c.fund_type = ft
          and not exists (
            select 1 from public.payment_allocations pa where pa.payment_id = p.id
          )
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
