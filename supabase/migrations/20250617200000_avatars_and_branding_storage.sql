-- Public buckets for profile avatars and condominium branding (logos)

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('branding', 'branding', true)
on conflict (id) do nothing;

-- Avatars: users manage files under their own folder ({user_id}/...)
create policy "Public read avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "Users upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Branding: admins manage files under their condominium folder ({condo_id}/...)
create policy "Public read branding"
on storage.objects for select
to public
using (bucket_id = 'branding');

create policy "Admins upload condo branding"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'branding'
  and public.has_role(
    ((storage.foldername(name))[1])::uuid,
    array['super_admin', 'admin']::public.membership_role[]
  )
);

create policy "Admins update condo branding"
on storage.objects for update
to authenticated
using (
  bucket_id = 'branding'
  and public.has_role(
    ((storage.foldername(name))[1])::uuid,
    array['super_admin', 'admin']::public.membership_role[]
  )
)
with check (
  bucket_id = 'branding'
  and public.has_role(
    ((storage.foldername(name))[1])::uuid,
    array['super_admin', 'admin']::public.membership_role[]
  )
);

create policy "Admins delete condo branding"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'branding'
  and public.has_role(
    ((storage.foldername(name))[1])::uuid,
    array['super_admin', 'admin']::public.membership_role[]
  )
);
