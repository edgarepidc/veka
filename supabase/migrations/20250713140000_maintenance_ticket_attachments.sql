-- Ticket evidence attachments (images + PDF) managed from admin

create table public.maintenance_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.maintenance_tickets (id) on delete cascade,
  file_url text not null,
  file_name text,
  sort_order int not null default 0,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_maintenance_ticket_attachments_ticket
  on public.maintenance_ticket_attachments (ticket_id, sort_order);

alter table public.maintenance_ticket_attachments enable row level security;

create policy "Members view maintenance ticket attachments"
on public.maintenance_ticket_attachments for select
using (
  exists (
    select 1
    from public.maintenance_tickets t
    where t.id = ticket_id
      and public.is_member_of(t.condominium_id)
      and (
        t.unit_id is null
        or t.unit_id in (select public.my_unit_ids(t.condominium_id))
        or public.has_role(
          t.condominium_id,
          array['super_admin', 'admin', 'staff', 'guard']::public.membership_role[]
        )
      )
  )
);

create policy "Staff manage maintenance ticket attachments"
on public.maintenance_ticket_attachments for all
using (
  exists (
    select 1
    from public.maintenance_tickets t
    where t.id = ticket_id
      and public.has_role(
        t.condominium_id,
        array['super_admin', 'admin', 'staff']::public.membership_role[]
      )
  )
)
with check (
  exists (
    select 1
    from public.maintenance_tickets t
    where t.id = ticket_id
      and public.has_role(
        t.condominium_id,
        array['super_admin', 'admin', 'staff']::public.membership_role[]
      )
  )
);
