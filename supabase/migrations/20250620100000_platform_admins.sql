-- Veka platform staff (app owners), separate from per-condominium super_admin

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

create policy "Platform admins read own row"
on public.platform_admins for select
using (user_id = auth.uid());

create policy "Platform admins view organizations"
on public.organizations for select
using (public.is_platform_admin());

create policy "Platform admins manage organizations"
on public.organizations for insert
with check (public.is_platform_admin());

create policy "Platform admins update organizations"
on public.organizations for update
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins view all condominiums"
on public.condominiums for select
using (public.is_platform_admin());

create policy "Platform admins manage condominiums"
on public.condominiums for insert
with check (public.is_platform_admin());

create policy "Platform admins update condominiums"
on public.condominiums for update
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins view all memberships"
on public.memberships for select
using (public.is_platform_admin());

create policy "Platform admins manage memberships"
on public.memberships for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Platform admins view all profiles"
on public.profiles for select
using (public.is_platform_admin());

create policy "Platform admins manage invitations"
on public.invitations for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public;
grant execute on function public.get_user_id_by_email(text) to service_role;
