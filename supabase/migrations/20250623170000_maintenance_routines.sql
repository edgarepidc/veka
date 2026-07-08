-- Calendario de rutinas: actividades por día con recurrencia e imágenes múltiples.

create type public.maintenance_recurrence as enum (
  'weekly',
  'biweekly',
  'monthly',
  'on_demand'
);

create table if not exists public.maintenance_routines (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  amenity_id uuid references public.amenities (id) on delete set null,
  title text not null,
  description text,
  day_of_week smallint check (day_of_week is null or (day_of_week >= 1 and day_of_week <= 7)),
  recurrence public.maintenance_recurrence not null default 'weekly',
  monthly_day smallint check (monthly_day is null or (monthly_day >= 1 and monthly_day <= 31)),
  anchor_date date,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on column public.maintenance_routines.day_of_week is '1=Lunes … 7=Domingo. Null para a demanda.';
comment on column public.maintenance_routines.monthly_day is 'Día del mes (1-31) cuando recurrence = monthly.';
comment on column public.maintenance_routines.anchor_date is 'Referencia para recurrencia quincenal.';

create table if not exists public.maintenance_routine_images (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.maintenance_routines (id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_maintenance_routines_condo_day
  on public.maintenance_routines (condominium_id, day_of_week, sort_order);

create index if not exists idx_maintenance_routine_images_routine
  on public.maintenance_routine_images (routine_id, sort_order);

alter table public.maintenance_routines enable row level security;
alter table public.maintenance_routine_images enable row level security;

create policy "Members view maintenance routines"
on public.maintenance_routines for select
using (public.is_member_of(condominium_id) and is_active = true);

create policy "Admins manage maintenance routines"
on public.maintenance_routines for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Members view routine images"
on public.maintenance_routine_images for select
using (
  exists (
    select 1
    from public.maintenance_routines r
    where r.id = routine_id
      and public.is_member_of(r.condominium_id)
      and r.is_active = true
  )
);

create policy "Admins manage routine images"
on public.maintenance_routine_images for all
using (
  exists (
    select 1
    from public.maintenance_routines r
    where r.id = routine_id
      and public.has_role(r.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1
    from public.maintenance_routines r
    where r.id = routine_id
      and public.has_role(r.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);
