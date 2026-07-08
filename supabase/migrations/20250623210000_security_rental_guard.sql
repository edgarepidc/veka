-- Rentas multi-día, restricción por adeudos y campos de vehículo.

alter table public.visits
  add column if not exists stay_days smallint check (stay_days is null or stay_days >= 1),
  add column if not exists vehicle_model text;

comment on column public.visits.stay_days is 'Días de estancia inclusivos para visit_type = rental.';
comment on column public.visits.vehicle_model is 'Marca, modelo y color del vehículo (rentas).';

create or replace function public.condo_blocks_rental_visits_if_overdue(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (settings -> 'security' ->> 'block_rental_visits_if_overdue')::boolean
      from public.condominiums
      where id = p_condominium_id
    ),
    false
  );
$$;

grant execute on function public.condo_blocks_rental_visits_if_overdue(uuid) to authenticated;

create or replace function public.apply_rental_visit_rules()
returns trigger
language plpgsql
as $$
begin
  if new.visit_type = 'rental' then
    if public.condo_blocks_rental_visits_if_overdue(new.condominium_id)
       and public.unit_has_delinquent_charges(new.unit_id) then
      raise exception 'No puedes registrar rentas mientras tengas adeudos de mantenimiento.'
        using errcode = 'P0001';
    end if;

    if new.stay_days is not null and new.stay_days >= 1 then
      new.valid_from := date_trunc('day', coalesce(new.valid_from, now()));
      new.valid_until :=
        new.valid_from
        + ((new.stay_days - 1) * interval '1 day')
        + interval '23 hours 59 minutes 59 seconds';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists visits_apply_rental_rules on public.visits;

create trigger visits_apply_rental_rules
before insert or update on public.visits
for each row
execute function public.apply_rental_visit_rules();
