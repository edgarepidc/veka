-- Community: poll payment eligibility, aggregate-friendly RLS, realtime tables.

alter table public.posts
  add column if not exists require_payment_current boolean not null default false;

comment on column public.posts.require_payment_current is
  'Encuestas: si true, solo unidades al corriente de pagos pueden votar.';

-- Reactions: members see all reactions in their condo; only manage own.
drop policy if exists "Members react to posts" on public.post_reactions;

create policy "Members view reactions"
on public.post_reactions for select
using (
  exists (
    select 1 from public.posts p
    where p.id = post_id and public.is_member_of(p.condominium_id)
  )
);

create policy "Members insert own reactions"
on public.post_reactions for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.posts p
    where p.id = post_id and public.is_member_of(p.condominium_id)
  )
);

create policy "Members delete own reactions"
on public.post_reactions for delete
using (user_id = auth.uid());

-- Poll votes: members see aggregate counts for polls in their condo.
drop policy if exists "Members vote once" on public.poll_votes;

create policy "Members view poll votes"
on public.poll_votes for select
using (
  exists (
    select 1
    from public.poll_options po
    join public.posts p on p.id = po.post_id
    where po.id = poll_option_id
      and public.is_member_of(p.condominium_id)
  )
);

drop policy if exists "Residents vote in polls by occupancy" on public.poll_votes;

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
      and (
        p.require_payment_current = false
        or m.unit_id is null
        or not public.unit_has_delinquent_charges(m.unit_id)
      )
  )
);

-- Realtime for live reaction and vote counts.
do $$
begin
  alter publication supabase_realtime add table public.post_reactions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.poll_votes;
exception
  when duplicate_object then null;
end $$;
