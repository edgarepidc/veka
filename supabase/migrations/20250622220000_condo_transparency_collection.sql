-- Aggregated collection expectations vs approved payments (cluster-level, no unit PII).

create or replace function public.condo_transparency_collection_flow(
  p_condominium_id uuid,
  p_since date default null
)
returns table (
  cluster_id uuid,
  item_date date,
  amount numeric,
  item_kind text
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
    u.cluster_id,
    c.due_date::date as item_date,
    c.amount::numeric as amount,
    'charge_due'::text as item_kind
  from public.charges c
  join public.units u on u.id = c.unit_id
  where c.condominium_id = p_condominium_id
    and u.cluster_id in (select cluster_id from my_clusters)
    and c.status not in ('cancelled', 'forgiven')
    and (p_since is null or c.due_date >= p_since)
  union all
  select
    u.cluster_id,
    coalesce(p.paid_at, p.created_at)::date as item_date,
    p.amount::numeric as amount,
    'payment_collected'::text as item_kind
  from public.payments p
  join public.charges c on c.id = p.charge_id
  join public.units u on u.id = p.unit_id
  where c.condominium_id = p_condominium_id
    and p.status = 'approved'
    and u.cluster_id in (select cluster_id from my_clusters)
    and (p_since is null or coalesce(p.paid_at, p.created_at)::date >= p_since);
$$;

grant execute on function public.condo_transparency_collection_flow(uuid, date) to authenticated;
