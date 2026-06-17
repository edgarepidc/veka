-- Admins can create and manage poll options for their condominiums

create policy "Admins manage poll options"
on public.poll_options for all
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_id
      and public.has_role(p.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
)
with check (
  exists (
    select 1
    from public.posts p
    where p.id = post_id
      and public.has_role(p.condominium_id, array['super_admin', 'admin']::public.membership_role[])
  )
);
