export const APP_NAME = 'Veka';

export const MOBILE_TABS = [
  { key: 'dashboard', label: 'Inicio', route: '/' },
  { key: 'community', label: 'Comunidad', route: '/community' },
  { key: 'spaces', label: 'Espacios', route: '/spaces' },
  { key: 'finance', label: 'Finanzas', route: '/finance' },
  { key: 'security', label: 'Seguridad', route: '/security' },
] as const;

export const VISIT_TYPES = ['visit', 'service', 'rental'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const CHARGE_STATUSES = ['pending', 'paid', 'overdue', 'cancelled'] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending_review', 'approved', 'rejected'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FUND_TYPES = ['operating', 'reserve'] as const;
export type FundType = (typeof FUND_TYPES)[number];

export const EXPENSE_KINDS = ['general', 'supplier', 'payroll'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_STATUSES = ['pending', 'paid'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
