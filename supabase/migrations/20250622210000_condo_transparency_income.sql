-- Condo income rows for resident transparency (payments without unit identifiers).

create or replace function public.condo_transparency_payment_income(
  p_condominium_id uuid,
  p_since date default null
)
returns table (
  category text,
  cluster_id uuid,
  income_date date,
  amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with my_clusters as (
    select distinct u.cluster_id
    from public.memberships m
    join public.units u on u.id = m.unit_id
    where m.user_id = auth.uid()
      and m.condominium_id = p_condominium_id
      and m.status = 'active'
      and u.cluster_id is not null
  )
  select
    'cuotas'::text as category,
    u.cluster_id,
    coalesce(p.paid_at, p.created_at)::date as income_date,
    p.amount::numeric as amount
  from public.payments p
  join public.charges c on c.id = p.charge_id
  join public.units u on u.id = p.unit_id
  where c.condominium_id = p_condominium_id
    and p.status = 'approved'
    and (p_since is null or coalesce(p.paid_at, p.created_at)::date >= p_since)
    and u.cluster_id in (select cluster_id from my_clusters);
$$;

grant execute on function public.condo_transparency_payment_income(uuid, date) to authenticated;
