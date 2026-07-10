-- Admin-controlled phone visibility for staff memberships (Comunidad → Mi comunidad).
alter table public.memberships
  add column if not exists show_phone_in_directory boolean not null default false;
