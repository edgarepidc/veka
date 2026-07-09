export const APP_NAME = 'Veka';

export const MOBILE_TABS = [
  { key: 'dashboard', label: 'Inicio', route: '/' },
  { key: 'community', label: 'Comunidad', route: '/community' },
  { key: 'spaces', label: 'Espacios', route: '/spaces' },
  { key: 'finance', label: 'Finanzas', route: '/finance' },
  { key: 'maintenance', label: 'Mantenimiento', route: '/maintenance' },
  { key: 'security', label: 'Seguridad', route: '/security' },
] as const;

export const VISIT_TYPES = ['visit', 'service', 'rental'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const CHARGE_STATUSES = ['pending', 'paid', 'overdue', 'cancelled', 'forgiven'] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'pending_review',
  'pending_second_review',
  'awaiting_payment',
  'approved',
  'rejected',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FUND_TYPES = ['operating', 'reserve'] as const;
export type FundType = (typeof FUND_TYPES)[number];

export const EXPENSE_KINDS = ['general', 'supplier', 'payroll'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_STATUSES = ['pending', 'paid'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  'mantenimiento',
  'servicios',
  'nomina',
  'seguridad',
  'administracion',
  'suministros',
  'otros',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const INCOME_CATEGORIES = [
  'cuotas',
  'extraordinario',
  'servicios',
  'multas',
  'otros',
] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const RESERVE_BUDGET_MODES = ['percent', 'components'] as const;
export type ReserveBudgetMode = (typeof RESERVE_BUDGET_MODES)[number];

export const RESERVE_INCOME_BASES = ['total', 'fees'] as const;
export type ReserveIncomeBase = (typeof RESERVE_INCOME_BASES)[number];

/** Capital replacement / major repair categories for reserve fund (components mode). */
export const RESERVE_EXPENSE_CATEGORIES = [
  'obra_civil',
  'cubierta',
  'elevadores',
  'instalaciones',
  'pavimento',
  'amenidades',
  'contingencia',
] as const;
export type ReserveExpenseCategory = (typeof RESERVE_EXPENSE_CATEGORIES)[number];

export const RESERVE_INCOME_CATEGORIES = ['aportacion'] as const;
export type ReserveIncomeCategory = (typeof RESERVE_INCOME_CATEGORIES)[number];

export const MAINTENANCE_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type MaintenanceTicketStatus = (typeof MAINTENANCE_TICKET_STATUSES)[number];

export const MAINTENANCE_TICKET_CATEGORIES = [
  'unit',
  'common_area',
  'plumbing',
  'electrical',
  'equipment',
  'other',
] as const;
export type MaintenanceTicketCategory = (typeof MAINTENANCE_TICKET_CATEGORIES)[number];

export const MAINTENANCE_RECURRENCES = ['weekly', 'biweekly', 'monthly', 'on_demand'] as const;
export type MaintenanceRecurrence = (typeof MAINTENANCE_RECURRENCES)[number];

export const FEE_SCOPES = ['general', 'cluster', 'extraordinary'] as const;
export type FeeScope = (typeof FEE_SCOPES)[number];

export const FEE_CAMPAIGN_STATUSES = ['active', 'cancelled'] as const;
export type FeeCampaignStatus = (typeof FEE_CAMPAIGN_STATUSES)[number];

export const RECURRING_FEE_STATUSES = ['active', 'paused', 'cancelled'] as const;
export type RecurringFeeStatus = (typeof RECURRING_FEE_STATUSES)[number];
