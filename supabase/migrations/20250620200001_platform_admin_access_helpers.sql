-- Platform admins can access tenant data for support / impersonation (JWT + platform_admins row)

create or replace function public.is_member_of(condo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.condominium_id = condo_id
        and m.status = 'active'
    );
$$;

create or replace function public.has_role(condo_id uuid, roles public.membership_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.condominium_id = condo_id
        and m.status = 'active'
        and m.role = any (roles)
    );
$$;

create policy "Platform admins read platform_admins"
on public.platform_admins for select
using (public.is_platform_admin());

create policy "Platform admins manage platform_admins"
on public.platform_admins for all
using (public.is_platform_admin())
with check (public.is_platform_admin());
