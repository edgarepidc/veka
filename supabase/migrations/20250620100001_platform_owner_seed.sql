-- Bootstrap platform owner (runs after user exists in auth.users)

insert into public.platform_admins (user_id, notes)
select id, 'Veka platform owner'
from auth.users
where lower(email) = lower('diazcruzee@gmail.com')
on conflict (user_id) do update set notes = excluded.notes;
