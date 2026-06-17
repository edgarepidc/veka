-- Maintenance tickets, schedules, and work evidence

create type public.maintenance_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.maintenance_ticket_category as enum (
  'unit',
  'common_area',
  'plumbing',
  'electrical',
  'equipment',
  'other'
);

create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  amenity_id uuid references public.amenities (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  category public.maintenance_ticket_category not null default 'unit',
  status public.maintenance_ticket_status not null default 'open',
  photo_url text,
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  amenity_id uuid references public.amenities (id) on delete set null,
  title text not null,
  description text,
  period_start date,
  period_end date,
  file_url text not null,
  file_name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.maintenance_work_logs (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  amenity_id uuid references public.amenities (id) on delete set null,
  ticket_id uuid references public.maintenance_tickets (id) on delete set null,
  title text not null,
  description text,
  work_date date not null default current_date,
  photo_url text,
  file_url text,
  file_name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_maintenance_tickets_condo_status on public.maintenance_tickets (condominium_id, status);
create index idx_maintenance_tickets_unit on public.maintenance_tickets (unit_id);
create index idx_maintenance_schedules_condo on public.maintenance_schedules (condominium_id, created_at desc);
create index idx_maintenance_work_logs_condo on public.maintenance_work_logs (condominium_id, work_date desc);

create trigger maintenance_tickets_updated_at
before update on public.maintenance_tickets
for each row execute function public.set_updated_at();

alter table public.maintenance_tickets enable row level security;
alter table public.maintenance_schedules enable row level security;
alter table public.maintenance_work_logs enable row level security;

-- Tickets: residents see own unit tickets; staff/admin see all
create policy "Members view maintenance tickets"
on public.maintenance_tickets for select
using (
  public.is_member_of(condominium_id)
  and (
    unit_id is null
    or unit_id in (select public.my_unit_ids(condominium_id))
    or public.has_role(
      condominium_id,
      array['super_admin', 'admin', 'staff', 'guard']::public.membership_role[]
    )
  )
);

create policy "Residents create unit tickets"
on public.maintenance_tickets for insert
with check (
  public.is_member_of(condominium_id)
  and created_by = auth.uid()
  and unit_id in (select public.my_unit_ids(condominium_id))
);

create policy "Staff manage maintenance tickets"
on public.maintenance_tickets for update
using (
  public.has_role(
    condominium_id,
    array['super_admin', 'admin', 'staff']::public.membership_role[]
  )
)
with check (
  public.has_role(
    condominium_id,
    array['super_admin', 'admin', 'staff']::public.membership_role[]
  )
);

create policy "Admins delete maintenance tickets"
on public.maintenance_tickets for delete
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Schedules: all members read; admins manage
create policy "Members view maintenance schedules"
on public.maintenance_schedules for select
using (public.is_member_of(condominium_id));

create policy "Admins manage maintenance schedules"
on public.maintenance_schedules for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Work logs: all members read; admins manage
create policy "Members view maintenance work logs"
on public.maintenance_work_logs for select
using (public.is_member_of(condominium_id));

create policy "Admins manage maintenance work logs"
on public.maintenance_work_logs for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

-- Storage bucket for calendars and evidence
insert into storage.buckets (id, name, public)
values ('maintenance-files', 'maintenance-files', false)
on conflict (id) do nothing;

create policy "Members read maintenance files"
on storage.objects for select
to authenticated
using (bucket_id = 'maintenance-files');

create policy "Admins manage maintenance files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'maintenance-files'
  and public.has_role(
    (storage.foldername(name))[1]::uuid,
    array['super_admin', 'admin']::public.membership_role[]
  )
)
with check (
  bucket_id = 'maintenance-files'
  and public.has_role(
    (storage.foldername(name))[1]::uuid,
    array['super_admin', 'admin']::public.membership_role[]
  )
);

create policy "Residents upload ticket photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'maintenance-files'
  and (storage.foldername(name))[2] = 'tickets'
  and public.is_member_of((storage.foldername(name))[1]::uuid)
);
