-- Demo finance data: recurring fees, payments, aging morosity, income entries
-- Safe to re-run (uses fixed UUIDs with ON CONFLICT)

-- Recurring maintenance fee (whole condo)
insert into public.recurring_fees (
  id, condominium_id, cluster_id, scope, concept, due_day, fund_type, status
)
values (
  '77777777-7777-7777-7777-777777777701',
  '22222222-2222-2222-2222-222222222222',
  null,
  'general',
  'Cuota de mantenimiento',
  5,
  'operating',
  'active'
)
on conflict (id) do update set status = excluded.status, concept = excluded.concept;

insert into public.recurring_fee_revisions (id, recurring_fee_id, base_amount, effective_from)
values
  ('77777777-7777-7777-7777-777777777711', '77777777-7777-7777-7777-777777777701', 3500.00, (date_trunc('month', current_date) - interval '2 months')::date),
  ('77777777-7777-7777-7777-777777777712', '77777777-7777-7777-7777-777777777701', 3800.00, date_trunc('month', current_date)::date)
on conflict (id) do nothing;

-- Current month charges (all units)
insert into public.charges (
  id, condominium_id, unit_id, recurring_fee_id, concept, amount, fund_type, due_date, status, period_month
)
values
  (
    '55555555-5555-5555-5555-555555555511',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444401',
    '77777777-7777-7777-7777-777777777701',
    'Cuota de mantenimiento — ' || to_char(current_date, 'TMMonth YYYY'),
    3800.00,
    'operating',
    (date_trunc('month', current_date) + interval '4 days')::date,
    'pending',
    date_trunc('month', current_date)::date
  ),
  (
    '55555555-5555-5555-5555-555555555512',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444402',
    '77777777-7777-7777-7777-777777777701',
    'Cuota de mantenimiento — ' || to_char(current_date, 'TMMonth YYYY'),
    3800.00,
    'operating',
    (date_trunc('month', current_date) + interval '4 days')::date,
    'pending',
    date_trunc('month', current_date)::date
  ),
  (
    '55555555-5555-5555-5555-555555555513',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444403',
    '77777777-7777-7777-7777-777777777701',
    'Cuota de mantenimiento — ' || to_char(current_date, 'TMMonth YYYY'),
    4560.00,
    'operating',
    (date_trunc('month', current_date) + interval '4 days')::date,
    'pending',
    date_trunc('month', current_date)::date
  )
on conflict (id) do nothing;

-- Previous month paid (A-101) with approved payment
insert into public.charges (
  id, condominium_id, unit_id, recurring_fee_id, concept, amount, fund_type, due_date, status, period_month
)
values (
  '55555555-5555-5555-5555-555555555521',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444401',
  '77777777-7777-7777-7777-777777777701',
  'Cuota de mantenimiento — ' || to_char(current_date - interval '1 month', 'TMMonth YYYY'),
  3500.00,
  'operating',
  (date_trunc('month', current_date) - interval '1 month' + interval '4 days')::date,
  'paid',
  (date_trunc('month', current_date) - interval '1 month')::date
)
on conflict (id) do update set status = excluded.status;

insert into public.payments (
  id, charge_id, condominium_id, unit_id, amount, status, payment_method, paid_at, created_at
)
values (
  '88888888-8888-8888-8888-888888888801',
  '55555555-5555-5555-5555-555555555521',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444401',
  3500.00,
  'approved',
  'transfer',
  (date_trunc('month', current_date) - interval '1 month' + interval '3 days'),
  (date_trunc('month', current_date) - interval '1 month' + interval '3 days')
)
on conflict (id) do nothing;

-- Previous month paid (A-102 demo unit) with approved payment
insert into public.charges (
  id, condominium_id, unit_id, recurring_fee_id, concept, amount, fund_type, due_date, status, period_month
)
values (
  '55555555-5555-5555-5555-555555555522',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444402',
  '77777777-7777-7777-7777-777777777701',
  'Cuota de mantenimiento — ' || to_char(current_date - interval '1 month', 'TMMonth YYYY'),
  3500.00,
  'operating',
  (date_trunc('month', current_date) - interval '1 month' + interval '4 days')::date,
  'paid',
  (date_trunc('month', current_date) - interval '1 month')::date
)
on conflict (id) do update set status = excluded.status;

insert into public.payments (
  id, charge_id, condominium_id, unit_id, amount, status, payment_method, paid_at, created_at
)
values (
  '88888888-8888-8888-8888-888888888803',
  '55555555-5555-5555-5555-555555555522',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444402',
  3500.00,
  'approved',
  'transfer',
  (date_trunc('month', current_date) - interval '1 month' + interval '2 days'),
  (date_trunc('month', current_date) - interval '1 month' + interval '2 days')
)
on conflict (id) do nothing;

-- Pending review payment (A-101 current month)
insert into public.payments (
  id, charge_id, condominium_id, unit_id, amount, status, payment_method, proof_url, paid_at, created_at
)
values (
  '88888888-8888-8888-8888-888888888802',
  '55555555-5555-5555-5555-555555555511',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444401',
  3800.00,
  'pending_review',
  'transfer',
  '22222222-2222-2222-2222-222222222222/44444444-4444-4444-4444-444444444401/demo-proof.jpg',
  now() - interval '1 day',
  now() - interval '1 day'
)
on conflict (id) do nothing;

-- Aging morosity: B-201 overdue buckets (A-102 excluded for clean mobile demo)
insert into public.charges (
  id, condominium_id, unit_id, concept, amount, fund_type, due_date, status, period_month
)
values
  (
    '55555555-5555-5555-5555-555555555532',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444403',
    'Cuota de mantenimiento — mora 45 días',
    4200.00,
    'operating',
    (current_date - interval '45 days')::date,
    'overdue',
    (date_trunc('month', current_date) - interval '2 months')::date
  ),
  (
    '55555555-5555-5555-5555-555555555533',
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444403',
    'Cuota extraordinaria — impermeabilización',
    8500.00,
    'reserve',
    (current_date - interval '95 days')::date,
    'overdue',
    (date_trunc('month', current_date) - interval '4 months')::date
  )
on conflict (id) do nothing;

-- Extraordinary fee campaign
insert into public.fee_campaigns (
  id, condominium_id, cluster_id, scope, concept, amount, fund_type, due_date, period_month, status
)
values (
  '77777777-7777-7777-7777-777777777702',
  '22222222-2222-2222-2222-222222222222',
  null,
  'extraordinary',
  'Cuota extraordinaria — elevadores',
  2500.00,
  'reserve',
  (current_date + interval '20 days')::date,
  date_trunc('month', current_date)::date,
  'active'
)
on conflict (id) do nothing;

-- Manual income entries
insert into public.income_entries (
  id, condominium_id, cluster_id, concept, amount, fund_type, category, income_date, notes
)
values
  (
    '99999999-9999-9999-9999-999999999901',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Renta de espacio en azotea',
    12000.00,
    'operating',
    'servicios',
    (current_date - interval '8 days')::date,
    'Evento corporativo'
  ),
  (
    '99999999-9999-9999-9999-999999999902',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333301',
    'Multa por ruido — Torre A',
    1500.00,
    'operating',
    'multas',
    (current_date - interval '15 days')::date,
    null
  )
on conflict (id) do nothing;

-- Expenses with cluster scope
insert into public.expenses (
  id, condominium_id, cluster_id, concept, amount, fund_type, category, expense_date, vendor_name, expense_kind, status
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333301',
  'Mantenimiento elevador Torre A',
  6200.00,
  'operating',
  'mantenimiento',
  (current_date - interval '6 days')::date,
  'Elevadores del Norte SA',
  'supplier',
  'paid'
)
on conflict (id) do nothing;

-- Additional paid expenses (budget vs actual demo)
insert into public.expenses (
  id, condominium_id, cluster_id, concept, amount, fund_type, category, expense_date, vendor_name, expense_kind, status
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Servicios de limpieza áreas comunes',
    8500.00,
    'operating',
    'servicios',
    (current_date - interval '12 days')::date,
    'Limpieza Total SA',
    'supplier',
    'paid'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Nómina conserjes — quincena',
    14500.00,
    'operating',
    'nomina',
    (current_date - interval '3 days')::date,
    'Nómina interna',
    'payroll',
    'paid'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Vigilancia mensual',
    4000.00,
    'operating',
    'seguridad',
    (date_trunc('month', current_date) + interval '2 days')::date,
    'Seguridad Privada MX',
    'supplier',
    'paid'
  )
on conflict (id) do nothing;

-- Annual operating budget (current fiscal year)
insert into public.annual_budgets (
  id, condominium_id, fiscal_year, fund_type, notes
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '22222222-2222-2222-2222-222222222222',
  extract(year from current_date)::int,
  'operating',
  'Presupuesto demo — aprobado en asamblea ordinaria'
)
on conflict (condominium_id, fiscal_year, fund_type, budget_scope_key) do update set notes = excluded.notes;

insert into public.budget_lines (id, budget_id, line_kind, category, annual_amount)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'expense', 'mantenimiento', 72000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'expense', 'servicios', 36000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'expense', 'nomina', 180000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'expense', 'seguridad', 48000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'expense', 'administracion', 24000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'expense', 'suministros', 18000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb07', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'expense', 'otros', 12000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'income', 'cuotas', 136800.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'income', 'servicios', 24000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb13', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'income', 'extraordinario', 60000.00)
on conflict (budget_id, line_kind, category) do update set annual_amount = excluded.annual_amount;

-- Torre A operating budget (independent from general)
insert into public.annual_budgets (
  id, condominium_id, fiscal_year, fund_type, cluster_id, notes
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  '22222222-2222-2222-2222-222222222222',
  extract(year from current_date)::int,
  'operating',
  '33333333-3333-3333-3333-333333333301',
  'Presupuesto demo Torre A'
)
on conflict (condominium_id, fiscal_year, fund_type, budget_scope_key) do update set notes = excluded.notes;

insert into public.budget_lines (id, budget_id, line_kind, category, annual_amount)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbc01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'expense', 'mantenimiento', 28000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbc02', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'expense', 'servicios', 12000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbc03', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'expense', 'nomina', 54000.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbc11', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'income', 'cuotas', 45600.00),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbc12', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'income', 'servicios', 8000.00)
on conflict (budget_id, line_kind, category) do update set annual_amount = excluded.annual_amount;

-- Reserve fund budget (20% of operating income)
insert into public.annual_budgets (
  id, condominium_id, fiscal_year, fund_type, notes, reserve_mode, reserve_percent, reserve_income_base
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
  '22222222-2222-2222-2222-222222222222',
  extract(year from current_date)::int,
  'reserve',
  'Reserva demo — 20% de ingresos operativos',
  'percent',
  20.00,
  'total'
)
on conflict (condominium_id, fiscal_year, fund_type, budget_scope_key) do update set
  notes = excluded.notes,
  reserve_mode = excluded.reserve_mode,
  reserve_percent = excluded.reserve_percent,
  reserve_income_base = excluded.reserve_income_base;

insert into public.budget_lines (id, budget_id, line_kind, category, annual_amount)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb21', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'income', 'aportacion', 44160.00)
on conflict (budget_id, line_kind, category) do update set annual_amount = excluded.annual_amount;

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
