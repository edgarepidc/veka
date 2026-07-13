-- Allow free-text recipient name when marking packages delivered at the gate.

alter table public.packages
  drop constraint if exists packages_delivered_to_fkey;

alter table public.packages
  alter column delivered_to type text
  using delivered_to::text;
