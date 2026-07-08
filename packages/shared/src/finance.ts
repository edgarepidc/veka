import type { ChargeStatus, ExpenseKind, ExpenseStatus, FundType, PaymentStatus } from './constants';

export function formatCurrency(amount: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function chargeStatusLabel(status: ChargeStatus): string {
  const labels: Record<ChargeStatus, string> = {
    pending: 'Pendiente',
    paid: 'Pagada',
    overdue: 'Vencida',
    cancelled: 'Cancelada',
    forgiven: 'Condonada',
  };
  return labels[status];
}

export function chargeStatusTone(status: ChargeStatus): 'default' | 'success' | 'warning' | 'danger' {
  const tones: Record<ChargeStatus, 'default' | 'success' | 'warning' | 'danger'> = {
    pending: 'warning',
    paid: 'success',
    overdue: 'danger',
    cancelled: 'default',
    forgiven: 'default',
  };
  return tones[status];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending_review: 'En revisión',
    pending_second_review: '2ª aprobación',
    awaiting_payment: 'Esperando pago',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  };
  return labels[status];
}

export function paymentStatusTone(
  status: PaymentStatus,
): 'default' | 'success' | 'warning' | 'danger' {
  const tones: Record<PaymentStatus, 'default' | 'success' | 'warning' | 'danger'> = {
    pending_review: 'warning',
    pending_second_review: 'warning',
    awaiting_payment: 'default',
    approved: 'success',
    rejected: 'danger',
  };
  return tones[status];
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const labels: Record<string, string> = {
    transfer: 'Transferencia',
    card: 'Tarjeta',
    oxxo: 'Oxxo',
    spei: 'SPEI',
    stripe: 'En línea',
  };
  if (!method) return '—';
  return labels[method] ?? method;
}

export function fundTypeLabel(fund: FundType): string {
  const labels: Record<FundType, string> = {
    operating: 'Fondo de operación',
    reserve: 'Fondo de reserva',
  };
  return labels[fund];
}

export function expenseKindLabel(kind: ExpenseKind): string {
  const labels: Record<ExpenseKind, string> = {
    general: 'General',
    supplier: 'Proveedor',
    payroll: 'Nómina',
  };
  return labels[kind];
}

export function expenseStatusLabel(status: ExpenseStatus): string {
  const labels: Record<ExpenseStatus, string> = {
    pending: 'Pendiente de pago',
    paid: 'Pagado / comprobado',
  };
  return labels[status];
}

export function expenseCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    mantenimiento: 'Mantenimiento',
    servicios: 'Servicios',
    nomina: 'Nómina',
    seguridad: 'Seguridad',
    administracion: 'Administración',
    suministros: 'Suministros',
    otros: 'Otros',
  };
  return labels[category] ?? category;
}
