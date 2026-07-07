-- Per-amenity reservation rules (horizon, lead times, active cap, blocked dates)

alter table public.amenities
  add column if not exists booking_horizon_days int not null default 7,
  add column if not exists min_booking_lead_hours int not null default 2,
  add column if not exists min_cancel_lead_hours int not null default 24,
  add column if not exists max_active_reservations int not null default 1,
  add column if not exists blocked_dates jsonb not null default '[]'::jsonb;

alter table public.amenities
  drop constraint if exists amenities_booking_horizon_positive;

alter table public.amenities
  add constraint amenities_booking_horizon_positive
  check (booking_horizon_days >= 1 and booking_horizon_days <= 90);

alter table public.amenities
  drop constraint if exists amenities_lead_hours_non_negative;

alter table public.amenities
  add constraint amenities_lead_hours_non_negative
  check (min_booking_lead_hours >= 0 and min_cancel_lead_hours >= 0);

alter table public.amenities
  drop constraint if exists amenities_max_active_non_negative;

alter table public.amenities
  add constraint amenities_max_active_non_negative
  check (max_active_reservations >= 0);
