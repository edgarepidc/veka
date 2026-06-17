-- Unit kind (casa / depto) and owner vs tenant occupancy

create type public.unit_kind as enum ('casa', 'depto');
create type public.unit_relationship as enum ('owner', 'tenant');

alter table public.units
  add column if not exists unit_kind public.unit_kind,
  add column if not exists unit_number text;

alter table public.memberships
  add column if not exists unit_relationship public.unit_relationship;

alter table public.invitations
  add column if not exists unit_relationship public.unit_relationship;

create unique index if not exists memberships_one_owner_per_unit
on public.memberships (unit_id)
where unit_relationship = 'owner' and status = 'active' and unit_id is not null;

create unique index if not exists memberships_one_tenant_per_unit
on public.memberships (unit_id)
where unit_relationship = 'tenant' and status = 'active' and unit_id is not null;

-- Accept invitations including occupancy role
create or replace function public.accept_pending_invitations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  invite record;
  accepted_count int := 0;
begin
  user_email := lower(auth.jwt() ->> 'email');
  if user_email is null then
    return 0;
  end if;

  for invite in
    select *
    from public.invitations
    where lower(email) = user_email
      and status = 'pending'
  loop
    insert into public.memberships (user_id, condominium_id, unit_id, role, status, unit_relationship)
    values (
      auth.uid(),
      invite.condominium_id,
      invite.unit_id,
      invite.role,
      'active',
      invite.unit_relationship
    )
    on conflict (user_id, condominium_id, unit_id) do update
      set
        role = excluded.role,
        status = 'active',
        unit_relationship = coalesce(excluded.unit_relationship, public.memberships.unit_relationship);

    update public.invitations
    set status = 'accepted', accepted_at = now()
    where id = invite.id;

    accepted_count := accepted_count + 1;
  end loop;

  return accepted_count;
end;
$$;
