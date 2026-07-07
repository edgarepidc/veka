-- Server-side reservation validation, capacity trigger, and RPCs for mobile clients.

create or replace function public.unit_has_delinquent_charges(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.charges c
    where c.unit_id = p_unit_id
      and c.status in ('pending', 'overdue')
      and (
        c.status = 'overdue'
        or (c.status = 'pending' and c.due_date < current_date)
      )
  );
$$;

create or replace function public.condo_blocks_reservations_if_overdue(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (settings -> 'spaces' ->> 'block_reservations_if_overdue')::boolean
      from public.condominiums
      where id = p_condominium_id
    ),
    false
  );
$$;

create or replace function public.amenity_date_blocked(p_blocked_dates jsonb, p_starts_at timestamptz)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_blocked_dates, '[]'::jsonb)) as d(value)
    where d.value = to_char(p_starts_at at time zone 'America/Mexico_City', 'YYYY-MM-DD')
  );
$$;

create or replace function public.check_reservation_capacity()
returns trigger
language plpgsql
as $$
declare
  v_max_concurrent int;
  v_overlap_count int;
begin
  if new.status not in ('confirmed', 'pending') then
    return new;
  end if;

  select max_concurrent_reservations
  into v_max_concurrent
  from public.amenities
  where id = new.amenity_id;

  if v_max_concurrent is null then
    v_max_concurrent := 1;
  end if;

  select count(*)
  into v_overlap_count
  from public.reservations r
  where r.amenity_id = new.amenity_id
    and r.status in ('confirmed', 'pending')
    and r.starts_at < new.ends_at
    and r.ends_at > new.starts_at
    and (tg_op = 'INSERT' or r.id <> new.id);

  if v_overlap_count >= v_max_concurrent then
    raise exception 'Ese horario ya no tiene cupo disponible.';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_capacity_check on public.reservations;

create trigger reservations_capacity_check
before insert or update of starts_at, ends_at, status, amenity_id
on public.reservations
for each row
execute function public.check_reservation_capacity();

create or replace function public.create_reservation_rpc(
  p_amenity_id uuid,
  p_unit_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amenity public.amenities%rowtype;
  v_reservation_id uuid;
  v_now timestamptz := now();
  v_count int;
  v_status public.reservation_status;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_month_start timestamptz;
  v_month_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'No autorizado';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Horario inválido';
  end if;

  select *
  into v_amenity
  from public.amenities
  where id = p_amenity_id
    and is_active = true;

  if not found then
    raise exception 'Amenidad no disponible';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.user_id = v_user_id
      and m.condominium_id = v_amenity.condominium_id
      and m.status = 'active'
      and m.unit_id = p_unit_id
  ) then
    raise exception 'Sin permiso para reservar en esta unidad';
  end if;

  if v_amenity.cluster_id is not null and not exists (
    select 1
    from public.units u
    where u.id = p_unit_id
      and u.cluster_id = v_amenity.cluster_id
  ) then
    raise exception 'Este espacio no está disponible para tu torre';
  end if;

  if public.amenity_date_blocked(v_amenity.blocked_dates, p_starts_at) then
    raise exception 'Ese día está bloqueado para reservas en este espacio';
  end if;

  if (p_starts_at at time zone 'America/Mexico_City')::date < (v_now at time zone 'America/Mexico_City')::date then
    raise exception 'No puedes reservar en el pasado';
  end if;

  if (p_starts_at at time zone 'America/Mexico_City')::date >=
     ((v_now at time zone 'America/Mexico_City')::date + v_amenity.booking_horizon_days) then
    raise exception 'Fuera del horizonte de reserva permitido';
  end if;

  if v_amenity.min_booking_lead_hours > 0
     and p_starts_at < v_now + make_interval(hours => v_amenity.min_booking_lead_hours) then
    raise exception 'Debes reservar con más anticipación para este horario';
  end if;

  if public.condo_blocks_reservations_if_overdue(v_amenity.condominium_id)
     and v_amenity.restrict_if_overdue
     and public.unit_has_delinquent_charges(p_unit_id) then
    raise exception 'Tienes adeudos pendientes. Regulariza tu cuenta para reservar este espacio.';
  end if;

  if v_amenity.max_active_reservations > 0 then
    select count(*)
    into v_count
    from public.reservations r
    where r.amenity_id = p_amenity_id
      and r.unit_id = p_unit_id
      and r.status in ('confirmed', 'pending')
      and r.ends_at >= v_now;

    if v_count >= v_amenity.max_active_reservations then
      raise exception 'Tu unidad ya alcanzó el límite de reservas activas en este espacio';
    end if;
  end if;

  v_day_start := date_trunc('day', p_starts_at);
  v_day_end := v_day_start + interval '1 day' - interval '1 microsecond';

  select count(*)
  into v_count
  from public.reservations r
  where r.amenity_id = p_amenity_id
    and r.user_id = v_user_id
    and r.status in ('confirmed', 'pending')
    and r.starts_at >= v_day_start
    and r.starts_at <= v_day_end;

  if v_count >= v_amenity.max_daily_reservations then
    raise exception 'Límite diario de reservas alcanzado para este espacio';
  end if;

  v_month_start := date_trunc('month', p_starts_at);
  v_month_end := (v_month_start + interval '1 month') - interval '1 microsecond';

  select count(*)
  into v_count
  from public.reservations r
  where r.amenity_id = p_amenity_id
    and r.user_id = v_user_id
    and r.status in ('confirmed', 'pending')
    and r.starts_at >= v_month_start
    and r.starts_at <= v_month_end;

  if v_count >= v_amenity.max_monthly_reservations then
    raise exception 'Límite mensual de reservas alcanzado para este espacio';
  end if;

  v_status := case
    when v_amenity.requires_approval then 'pending'::public.reservation_status
    else 'confirmed'::public.reservation_status
  end;

  insert into public.reservations (
    amenity_id,
    condominium_id,
    unit_id,
    user_id,
    starts_at,
    ends_at,
    status
  )
  values (
    p_amenity_id,
    v_amenity.condominium_id,
    p_unit_id,
    v_user_id,
    p_starts_at,
    p_ends_at,
    v_status
  )
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

create or replace function public.cancel_reservation_rpc(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.reservations%rowtype;
  v_min_cancel_hours int;
  v_is_admin boolean;
begin
  if v_user_id is null then
    raise exception 'No autorizado';
  end if;

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id;

  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  if v_reservation.status not in ('confirmed', 'pending') then
    raise exception 'Esta reserva ya no se puede cancelar';
  end if;

  v_is_admin := public.has_role(
    v_reservation.condominium_id,
    array['super_admin', 'admin']::public.membership_role[]
  );

  if v_reservation.user_id <> v_user_id and not v_is_admin then
    raise exception 'No autorizado';
  end if;

  if v_reservation.user_id = v_user_id and not v_is_admin then
    select a.min_cancel_lead_hours
    into v_min_cancel_hours
    from public.amenities a
    where a.id = v_reservation.amenity_id;

    if coalesce(v_min_cancel_hours, 0) > 0
       and v_reservation.starts_at < now() + make_interval(hours => v_min_cancel_hours) then
      raise exception 'El plazo para cancelar esta reserva ya venció';
    end if;
  end if;

  update public.reservations
  set status = 'cancelled'
  where id = p_reservation_id
    and status in ('confirmed', 'pending');
end;
$$;

revoke all on function public.create_reservation_rpc(uuid, uuid, timestamptz, timestamptz) from public;
revoke all on function public.cancel_reservation_rpc(uuid) from public;

grant execute on function public.create_reservation_rpc(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.cancel_reservation_rpc(uuid) to authenticated;

grant execute on function public.unit_has_delinquent_charges(uuid) to authenticated;
grant execute on function public.condo_blocks_reservations_if_overdue(uuid) to authenticated;
