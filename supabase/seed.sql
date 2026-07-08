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
  booking_horizon_days,
  min_booking_lead_hours,
  min_cancel_lead_hours,
  max_active_reservations,
  blocked_dates,
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
    30,
    2,
    24,
    1,
    '["2026-12-25","2026-01-01"]'::jsonb,
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
    14,
    1,
    12,
    2,
    '[]'::jsonb,
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
    60,
    48,
    72,
    1,
    '["2026-12-24","2026-12-25","2026-12-31","2026-01-01"]'::jsonb,
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
  booking_horizon_days = excluded.booking_horizon_days,
  min_booking_lead_hours = excluded.min_booking_lead_hours,
  min_cancel_lead_hours = excluded.min_cancel_lead_hours,
  max_active_reservations = excluded.max_active_reservations,
  blocked_dates = excluded.blocked_dates,
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

-- Overdue charges for morosity demo (B-201 only; A-102 stays clean for mobile demo)
insert into public.charges (
  id, condominium_id, unit_id, concept, amount, fund_type, due_date, status, period_month
)
values
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

-- Demo CLABE for SPEI / admin reconciliation
insert into public.bank_accounts (
  id, condominium_id, name, bank_name, account_last4, clabe, currency, is_active
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb201',
  '22222222-2222-2222-2222-222222222222',
  'Cuenta operativa Las Palmas',
  'BBVA México',
  '4821',
  '012180001234567890',
  'MXN',
  true
)
on conflict (id) do update set
  name = excluded.name,
  bank_name = excluded.bank_name,
  account_last4 = excluded.account_last4,
  clabe = excluded.clabe,
  is_active = excluded.is_active;

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

-- Demo maintenance routines (weekly calendar)
insert into public.maintenance_routines (
  id, condominium_id, amenity_id, title, description, day_of_week, recurrence, created_by
)
select
  '66666666-6666-6666-6666-666666666610',
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
  'Mantenimiento de alberca',
  'Limpieza de agua, revisión de filtros y cloro.',
  1,
  'weekly',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.maintenance_routines (
  id, condominium_id, title, description, day_of_week, recurrence, created_by
)
select
  '66666666-6666-6666-6666-666666666611',
  '22222222-2222-2222-2222-222222222222',
  'Poda de áreas comunes',
  'Jardinería en camellones y áreas verdes.',
  2,
  'weekly',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.maintenance_routines (
  id, condominium_id, title, description, day_of_week, recurrence, created_by
)
select
  '66666666-6666-6666-6666-666666666612',
  '22222222-2222-2222-2222-222222222222',
  'Recolección de basura',
  'Ronda en áreas comunes y contenedores.',
  3,
  'weekly',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.maintenance_routines (
  id, condominium_id, amenity_id, title, description, day_of_week, recurrence, anchor_date, created_by
)
select
  '66666666-6666-6666-6666-666666666613',
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
  'Limpieza profunda de alberca',
  'Aspirado y lavado de muros.',
  6,
  'biweekly',
  current_date,
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.maintenance_routines (
  id, condominium_id, title, description, day_of_week, recurrence, monthly_day, created_by
)
select
  '66666666-6666-6666-6666-666666666614',
  '22222222-2222-2222-2222-222222222222',
  'Revisión de bombas de agua',
  'Inspección de cuarto de máquinas.',
  5,
  'monthly',
  15,
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.maintenance_routines (
  id, condominium_id, title, description, recurrence, created_by
)
select
  '66666666-6666-6666-6666-666666666615',
  '22222222-2222-2222-2222-222222222222',
  'Reparación de elevador',
  'Solo cuando falla o hay revisión externa.',
  'on_demand',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.maintenance_routine_images (id, routine_id, image_url, sort_order)
values
  ('66666666-6666-6666-6666-666666666621', '66666666-6666-6666-6666-666666666610', 'https://picsum.photos/seed/veka-pool-1/800/500', 0),
  ('66666666-6666-6666-6666-666666666622', '66666666-6666-6666-6666-666666666610', 'https://picsum.photos/seed/veka-pool-2/800/500', 1),
  ('66666666-6666-6666-6666-666666666623', '66666666-6666-6666-6666-666666666611', 'https://picsum.photos/seed/veka-garden/800/500', 0)
on conflict (id) do nothing;

-- Legacy schedule row (optional PDF calendar)
insert into public.maintenance_schedules (
  id, condominium_id, amenity_id, title, description, period_start, period_end, file_url, file_name, created_by
)
select
  '66666666-6666-6666-6666-666666666602',
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
  'Calendario de mantenimiento — Alberca',
  'Limpieza profunda cada sábado de 8:00 a 11:00. Química y revisión de filtros los miércoles.',
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  'calendario-alberca.pdf',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.maintenance_work_logs (
  id, condominium_id, amenity_id, ticket_id, title, description, work_date, file_url, file_name, created_by
)
select
  '66666666-6666-6666-6666-666666666603',
  '22222222-2222-2222-2222-222222222222',
  null,
  '66666666-6666-6666-6666-666666666601',
  'Inspección inicial — fuga lavabo A-102',
  'Se identificó empaque dañado en mezcladora. Se programó cambio de refacción.',
  current_date - 1,
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  'reporte-plomeria.pdf',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

-- Demo community, reservations, security, and documents (resident A-102)
insert into public.posts (
  id, condominium_id, author_id, post_type, title, body, is_pinned, is_formal, is_admin_only
)
select
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001',
  '22222222-2222-2222-2222-222222222222',
  u.id,
  'announcement',
  'Mantenimiento de alberca — sábado 8:00',
  'La alberca cerrará el sábado de 8:00 a 11:00 para limpieza profunda. Gracias por su comprensión.',
  true,
  false,
  false
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.posts (
  id, condominium_id, author_id, post_type, title, body, is_pinned, is_formal, is_admin_only
)
select
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002',
  '22222222-2222-2222-2222-222222222222',
  u.id,
  'poll',
  '¿Apruebas el presupuesto de jardinería Q3?',
  'Votación formal del consejo para el trimestre julio–septiembre.',
  false,
  true,
  false
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.poll_options (id, post_id, label)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb011', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'Sí, aprobar'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb012', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'No, requiere ajustes')
on conflict (id) do nothing;

insert into public.reservations (
  id, amenity_id, condominium_id, unit_id, user_id, starts_at, ends_at, status
)
select
  'cccccccc-cccc-cccc-cccc-cccccccccc01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444402',
  u.id,
  (date_trunc('day', now()) + interval '1 day' + interval '18 hours'),
  (date_trunc('day', now()) + interval '1 day' + interval '19 hours'),
  'confirmed'
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.reservations (
  id, amenity_id, condominium_id, unit_id, user_id, starts_at, ends_at, status
)
select
  'cccccccc-cccc-cccc-cccc-cccccccccc02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444402',
  u.id,
  (date_trunc('day', now()) + interval '10 days' + interval '14 hours'),
  (date_trunc('day', now()) + interval '10 days' + interval '16 hours'),
  'pending'
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.visits (
  id, condominium_id, unit_id, created_by, visitor_name, visitor_phone, visit_type,
  qr_token, valid_from, valid_until
)
select
  'dddddddd-dddd-dddd-dddd-dddddddddd01',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444402',
  u.id,
  'Carlos Méndez',
  '5512345678',
  'visit',
  'a1b2c3d4e5f6789012345678abcdef01',
  now() - interval '1 hour',
  now() + interval '23 hours'
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.packages (
  id, condominium_id, unit_id, carrier, tracking_number, notes, status, received_by
)
select
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444402',
  'Amazon',
  'AMZ-482910',
  'Caja mediana — recepción principal',
  'received',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.documents (id, condominium_id, title, category, file_url, uploaded_by)
select
  '11111111-1111-4111-8111-111111111101',
  '22222222-2222-2222-2222-222222222222',
  'Reglamento interno',
  'Reglamento',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;

insert into public.documents (id, condominium_id, title, category, file_url, uploaded_by)
select
  '11111111-1111-4111-8111-111111111102',
  '22222222-2222-2222-2222-222222222222',
  'Minuta asamblea marzo 2025',
  'Minutas',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  u.id
from auth.users u
where u.email = 'diazcruzee@outlook.com'
on conflict (id) do nothing;
