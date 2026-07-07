-- Demo seed data for local development (optional — run after first migration)

insert into public.organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Veka Demo Admin', 'veka-demo')
on conflict (slug) do nothing;

insert into public.condominiums (id, organization_id, name, slug, address, timezone)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Residencial Las Palmas',
  'las-palmas',
  'Av. Reforma 123, CDMX',
  'America/Mexico_City'
)
on conflict (slug) do nothing;

insert into public.clusters (id, condominium_id, name)
values
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222222', 'Torre A'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222222', 'Torre B')
on conflict do nothing;

insert into public.units (id, condominium_id, cluster_id, identifier, coefficient)
values
  ('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333301', 'A-101', 1.0),
  ('44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333301', 'A-102', 1.0),
  ('44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333302', 'B-201', 1.2)
on conflict do nothing;

insert into public.fund_balances (condominium_id, fund_type, balance, as_of_date)
values
  ('22222222-2222-2222-2222-222222222222', 'operating', 185000.00, current_date),
  ('22222222-2222-2222-2222-222222222222', 'reserve', 420000.00, current_date)
on conflict (condominium_id, fund_type) do update set balance = excluded.balance;

insert into public.amenities (
  id,
  condominium_id,
  cluster_id,
  name,
  description,
  image_url,
  max_daily_reservations,
  max_monthly_reservations,
  max_concurrent_reservations,
  requires_approval,
  restrict_if_overdue,
  open_time,
  close_time,
  slot_duration_minutes
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Alberca',
    'Área de alberca y chapoteadero',
    '22222222-2222-2222-2222-222222222222/amenities/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01.jpg',
    1,
    8,
    1,
    false,
    true,
    '08:00',
    '20:00',
    60
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Gimnasio',
    'Gimnasio equipado con cardio y pesas',
    '22222222-2222-2222-2222-222222222222/amenities/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02.jpg',
    2,
    20,
    8,
    false,
    false,
    '06:00',
    '22:00',
    60
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Salón de eventos',
    'Salón para 40 personas — requiere aprobación de administración',
    '22222222-2222-2222-2222-222222222222/amenities/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03.jpg',
    1,
    2,
    1,
    true,
    true,
    '09:00',
    '22:00',
    120
  )
on conflict (id) do update set
  description = excluded.description,
  image_url = excluded.image_url,
  max_daily_reservations = excluded.max_daily_reservations,
  max_monthly_reservations = excluded.max_monthly_reservations,
  max_concurrent_reservations = excluded.max_concurrent_reservations,
  requires_approval = excluded.requires_approval,
  restrict_if_overdue = excluded.restrict_if_overdue,
  open_time = excluded.open_time,
  close_time = excluded.close_time,
  slot_duration_minutes = excluded.slot_duration_minutes;

insert into public.notification_rules (condominium_id, rule_key, days_before, days_after, is_enabled)
values
  ('22222222-2222-2222-2222-222222222222', 'charge_due_soon', 3, null, true),
  ('22222222-2222-2222-2222-222222222222', 'charge_overdue', null, 1, true),
  ('22222222-2222-2222-2222-222222222222', 'charge_overdue_reminder', null, 7, true)
on conflict (condominium_id, rule_key) do nothing;

-- Demo charges (unit A-101)
insert into public.charges (
  id, condominium_id, unit_id, concept, amount, fund_type, due_date, status, period_month
)
values
  (
    '55555555-5555-5555-5555-555555555501',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444401',
    'Cuota de mantenimiento — Junio 2025',
    3500.00,
    'operating',
    (current_date + interval '14 days')::date,
    'pending',
    date_trunc('month', current_date)::date
  ),
  (
    '55555555-5555-5555-5555-555555555502',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444401',
    'Cuota de mantenimiento — Mayo 2025',
    3500.00,
    'operating',
    (current_date - interval '10 days')::date,
    'paid',
    (date_trunc('month', current_date) - interval '1 month')::date
  )
on conflict (id) do nothing;

insert into public.expenses (
  condominium_id, concept, amount, fund_type, category, expense_date, vendor_name, expense_kind, status
)
values
  (
    '22222222-2222-2222-2222-222222222222',
    'Mantenimiento elevadores',
    18200.00,
    'operating',
    'mantenimiento',
    (current_date - interval '5 days')::date,
    'Elevadores del Norte SA',
    'supplier',
    'paid'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Jardinería áreas comunes',
    4500.00,
    'operating',
    'servicios',
    (current_date - interval '12 days')::date,
    'Verde Total',
    'supplier',
    'paid'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Servicio de vigilancia — Junio',
    28500.00,
    'operating',
    'nomina',
    (current_date - interval '3 days')::date,
    'Carlos Méndez',
    'payroll',
    'paid'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Reparación bomba de agua',
    9800.00,
    'operating',
    'mantenimiento',
    (current_date + interval '7 days')::date,
    'Plomería Express',
    'supplier',
    'pending'
  )
on conflict do nothing;

-- Overdue charges for morosity demo
insert into public.charges (
  id, condominium_id, unit_id, concept, amount, fund_type, due_date, status, period_month
)
values
  (
    '55555555-5555-5555-5555-555555555503',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444402',
    'Cuota de mantenimiento — Mayo 2025',
    3500.00,
    'operating',
    (current_date - interval '25 days')::date,
    'overdue',
    (date_trunc('month', current_date) - interval '1 month')::date
  ),
  (
    '55555555-5555-5555-5555-555555555504',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444403',
    'Cuota de mantenimiento — Mayo 2025',
    4200.00,
    'operating',
    (current_date - interval '18 days')::date,
    'overdue',
    (date_trunc('month', current_date) - interval '1 month')::date
  )
on conflict (id) do nothing;

-- Demo maintenance ticket (resident A-102)
insert into public.maintenance_tickets (
  id, condominium_id, unit_id, created_by, title, description, category, status
)
select
  '66666666-6666-6666-6666-666666666601',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444402',
  u.id,
  'Fuga en lavabo del baño principal',
  'Gotea el lavabo desde ayer por la tarde.',
  'plumbing',
  'open'
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;
