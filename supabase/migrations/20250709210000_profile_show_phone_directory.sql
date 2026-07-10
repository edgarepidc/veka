-- Opt-in: show phone number in community/admin directory (Personal tab).
alter table public.profiles
  add column if not exists show_phone_in_directory boolean not null default false;
