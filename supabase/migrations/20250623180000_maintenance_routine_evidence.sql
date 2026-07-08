-- Evidencia por fecha vinculada a cada actividad del calendario (no fotos de referencia).

create table if not exists public.maintenance_routine_evidence (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.maintenance_routines (id) on delete cascade,
  evidence_date date not null,
  image_url text not null,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_maintenance_routine_evidence_routine_date
  on public.maintenance_routine_evidence (routine_id, evidence_date desc);

-- Migrar imágenes de referencia existentes como evidencia de hoy
insert into public.maintenance_routine_evidence (routine_id, evidence_date, image_url, sort_order, created_at)
select
  ri.routine_id,
  current_date,
  ri.image_url,
  ri.sort_order,
  ri.created_at
from public.maintenance_routine_images ri;

alter table public.maintenance_routine_evidence enable row level security;

create policy "Members view routine evidence"
on public.maintenance_routine_evidence for select
using (
  exists (
    select 1
    from public.maintenance_routines r
    where r.id = routine_id
      and public.is_member_of(r.condominium_id)
      and r.is_active = true
  )
);

create policy "Admins manage routine evidence"
on public.maintenance_routine_evidence for all
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
