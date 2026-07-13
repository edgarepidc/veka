-- Allow all condo members to read maintenance tickets (scope filter: Todo / torres).
-- Creating tickets stays restricted to the member's own unit.

drop policy if exists "Members view maintenance tickets" on public.maintenance_tickets;
create policy "Members view maintenance tickets"
on public.maintenance_tickets for select
using (public.is_member_of(condominium_id));

drop policy if exists "Members view maintenance ticket attachments" on public.maintenance_ticket_attachments;
create policy "Members view maintenance ticket attachments"
on public.maintenance_ticket_attachments for select
using (
  exists (
    select 1
    from public.maintenance_tickets t
    where t.id = ticket_id
      and public.is_member_of(t.condominium_id)
  )
);
