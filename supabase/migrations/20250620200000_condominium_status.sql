-- Tenant lifecycle status for platform operations

create type public.condominium_status as enum ('active', 'suspended', 'archived');

alter table public.condominiums
  add column status public.condominium_status not null default 'active';

create index idx_condominiums_status on public.condominiums (status);
