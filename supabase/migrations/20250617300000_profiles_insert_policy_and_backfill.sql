-- Allow users to create their own profile row (needed when signup predates trigger)
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

-- Backfill missing profiles for existing auth users
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
