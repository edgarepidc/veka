-- Alcance por cluster en rutinas (vía amenity) y permisos de staff para evidencia.

create or replace function public.maintenance_routine_visible_to_member(p_routine_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maintenance_routines r
    left join public.amenities a on a.id = r.amenity_id
    where r.id = p_routine_id
      and r.is_active = true
      and public.is_member_of(r.condominium_id)
      and (
        public.has_role(
          r.condominium_id,
          array['super_admin', 'admin', 'staff']::public.membership_role[]
        )
        or r.amenity_id is null
        or a.cluster_id is null
        or a.cluster_id in (select public.member_cluster_ids_for_condo(r.condominium_id))
      )
  );
$$;

grant execute on function public.maintenance_routine_visible_to_member(uuid) to authenticated;

drop policy if exists "Members view maintenance routines" on public.maintenance_routines;

create policy "Members view maintenance routines"
on public.maintenance_routines for select
using (public.maintenance_routine_visible_to_member(id));

drop policy if exists "Members view routine images" on public.maintenance_routine_images;

create policy "Members view routine images"
on public.maintenance_routine_images for select
using (public.maintenance_routine_visible_to_member(routine_id));

drop policy if exists "Members view routine evidence" on public.maintenance_routine_evidence;

create policy "Members view routine evidence"
on public.maintenance_routine_evidence for select
using (public.maintenance_routine_visible_to_member(routine_id));

create policy "Staff insert routine evidence"
on public.maintenance_routine_evidence for insert
with check (
  exists (
    select 1
    from public.maintenance_routines r
    where r.id = routine_id
      and public.has_role(r.condominium_id, array['staff']::public.membership_role[])
  )
);

create policy "Staff upload routine evidence files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'maintenance-files'
  and (storage.foldername(name))[2] = 'routine-evidence'
  and public.has_role(
    (storage.foldername(name))[1]::uuid,
    array['staff']::public.membership_role[]
  )
);
