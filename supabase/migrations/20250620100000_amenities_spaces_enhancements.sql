-- Amenities: cluster scope, images, approval, overdue restriction, concurrent capacity

alter type public.reservation_status add value if not exists 'pending';

alter table public.amenities
  add column if not exists cluster_id uuid references public.clusters (id) on delete set null,
  add column if not exists image_url text,
  add column if not exists requires_approval boolean not null default false,
  add column if not exists restrict_if_overdue boolean not null default false,
  add column if not exists max_concurrent_reservations int not null default 1;

alter table public.amenities
  drop constraint if exists amenities_condominium_id_name_key;

create unique index if not exists amenities_condo_scope_name_idx
  on public.amenities (
    condominium_id,
    coalesce(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid),
    name
  );

alter table public.amenities
  add constraint amenities_max_concurrent_positive
  check (max_concurrent_reservations >= 1);

insert into storage.buckets (id, name, public)
values ('amenity-images', 'amenity-images', true)
on conflict (id) do nothing;

create policy "Public read amenity images"
on storage.objects for select
using (bucket_id = 'amenity-images');

create policy "Admins upload amenity images"
on storage.objects for insert
with check (
  bucket_id = 'amenity-images'
  and (storage.foldername(name))[1] in (
    select c.id::text
    from public.condominiums c
    join public.memberships m on m.condominium_id = c.id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('super_admin', 'admin')
  )
);

create policy "Admins update amenity images"
on storage.objects for update
using (
  bucket_id = 'amenity-images'
  and (storage.foldername(name))[1] in (
    select c.id::text
    from public.condominiums c
    join public.memberships m on m.condominium_id = c.id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('super_admin', 'admin')
  )
);

create policy "Admins delete amenity images"
on storage.objects for delete
using (
  bucket_id = 'amenity-images'
  and (storage.foldername(name))[1] in (
    select c.id::text
    from public.condominiums c
    join public.memberships m on m.condominium_id = c.id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('super_admin', 'admin')
  )
);
