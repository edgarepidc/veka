-- Invitations, storage policies, and finance helpers

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  email text not null,
  role public.membership_role not null default 'resident',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index invitations_pending_email_idx
on public.invitations (condominium_id, lower(email))
where status = 'pending';

create index idx_invitations_email on public.invitations (lower(email));

alter table public.invitations enable row level security;

create policy "Admins manage invitations"
on public.invitations for all
using (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]))
with check (public.has_role(condominium_id, array['super_admin', 'admin']::public.membership_role[]));

create policy "Users view own invitations"
on public.invitations for select
using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Accept pending invitations for the logged-in user
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
    insert into public.memberships (user_id, condominium_id, unit_id, role, status)
    values (auth.uid(), invite.condominium_id, invite.unit_id, invite.role, 'active')
    on conflict (user_id, condominium_id, unit_id) do update
      set role = excluded.role, status = 'active';

    update public.invitations
    set status = 'accepted', accepted_at = now()
    where id = invite.id;

    accepted_count := accepted_count + 1;
  end loop;

  return accepted_count;
end;
$$;

grant execute on function public.accept_pending_invitations() to authenticated;

-- Auto-mark overdue charges
create or replace function public.refresh_charge_statuses()
returns void
language sql
security definer
set search_path = public
as $$
  update public.charges
  set status = 'overdue', updated_at = now()
  where status = 'pending'
    and due_date < current_date;
$$;

-- Storage policies
create policy "Members read documents"
on storage.objects for select
to authenticated
using (bucket_id = 'documents');

create policy "Admins upload documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'documents');

create policy "Residents upload payment proofs"
on storage.objects for insert
to authenticated
with check (bucket_id = 'payment-proofs');

create policy "Members read payment proofs in their condo"
on storage.objects for select
to authenticated
using (bucket_id = 'payment-proofs');

create policy "Admins manage payment proofs"
on storage.objects for all
to authenticated
using (bucket_id = 'payment-proofs')
with check (bucket_id = 'payment-proofs');

create policy "Admins manage expense evidence"
on storage.objects for all
to authenticated
using (bucket_id = 'expense-evidence')
with check (bucket_id = 'expense-evidence');

create policy "Staff manage package photos"
on storage.objects for all
to authenticated
using (bucket_id = 'packages')
with check (bucket_id = 'packages');

create policy "Members read post images"
on storage.objects for select
to authenticated
using (bucket_id = 'posts');

create policy "Members upload post images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'posts');
