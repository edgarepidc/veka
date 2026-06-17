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

insert into public.amenities (condominium_id, name, description, max_daily_reservations, max_monthly_reservations)
values
  ('22222222-2222-2222-2222-222222222222', 'Alberca', 'Área de alberca y chapoteadero', 1, 8),
  ('22222222-2222-2222-2222-222222222222', 'Gimnasio', 'Gimnasio equipado', 2, 20),
  ('22222222-2222-2222-2222-222222222222', 'Salón de eventos', 'Salón para 40 personas', 1, 2)
on conflict do nothing;

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
  condominium_id, concept, amount, fund_type, category, expense_date, vendor_name
)
values
  (
    '22222222-2222-2222-2222-222222222222',
    'Mantenimiento elevadores',
    18200.00,
    'operating',
    'mantenimiento',
    (current_date - interval '5 days')::date,
    'Elevadores del Norte SA'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Jardinería áreas comunes',
    4500.00,
    'operating',
    'servicios',
    (current_date - interval '12 days')::date,
    'Verde Total'
  )
on conflict do nothing;
