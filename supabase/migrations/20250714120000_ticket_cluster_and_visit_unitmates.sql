-- Ticket visibility by cluster (multi-tower) + co-residents can view visits on their unit.

create or replace function public.maintenance_ticket_visible_to_member(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maintenance_tickets t
    left join public.units u on u.id = t.unit_id
    left join public.amenities a on a.id = t.amenity_id
    where t.id = p_ticket_id
      and public.is_member_of(t.condominium_id)
      and (
        public.has_role(
          t.condominium_id,
          array['super_admin', 'admin', 'staff', 'guard']::public.membership_role[]
        )
        or t.unit_id is null
        or u.cluster_id is null
        or u.cluster_id in (select public.member_cluster_ids_for_condo(t.condominium_id))
        or (
          t.amenity_id is not null
          and (
            a.cluster_id is null
            or a.cluster_id in (select public.member_cluster_ids_for_condo(t.condominium_id))
          )
        )
      )
  );
$$;

grant execute on function public.maintenance_ticket_visible_to_member(uuid) to authenticated;

drop policy if exists "Members view maintenance tickets" on public.maintenance_tickets;
create policy "Members view maintenance tickets"
on public.maintenance_tickets for select
using (public.maintenance_ticket_visible_to_member(id));

drop policy if exists "Members view maintenance ticket attachments" on public.maintenance_ticket_attachments;
create policy "Members view maintenance ticket attachments"
on public.maintenance_ticket_attachments for select
using (public.maintenance_ticket_visible_to_member(ticket_id));

drop policy if exists "Residents manage own visits" on public.visits;
create policy "Residents manage own visits"
on public.visits for select
using (
  public.is_member_of(condominium_id)
  and (
    created_by = auth.uid()
    or unit_id in (select public.my_unit_ids(condominium_id))
    or public.has_role(
      condominium_id,
      array['super_admin', 'admin', 'guard', 'staff']::public.membership_role[]
    )
  )
);
