-- Formal polls: only resident owners vote; tenants may vote in informal polls.
-- Propietarios e inquilinos comparten el resto de permisos de residente.

alter table public.posts
  add column if not exists is_formal boolean not null default true;

comment on column public.posts.is_formal is
  'Encuestas formales (true): solo residente propietario puede votar. Informales: propietario e inquilino.';

drop policy if exists "Members insert votes" on public.poll_votes;

create policy "Residents vote in polls by occupancy"
on public.poll_votes for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    join public.posts p on p.id = po.post_id
    join public.memberships m
      on m.user_id = auth.uid()
      and m.condominium_id = p.condominium_id
      and m.status = 'active'
    where po.id = poll_option_id
      and (
        p.is_formal = false
        or m.unit_relationship is null
        or m.unit_relationship = 'owner'
      )
  )
);
