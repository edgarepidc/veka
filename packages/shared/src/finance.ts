import type { ChargeStatus, PaymentStatus } from './constants';

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
  };
  return labels[status];
}

export function chargeStatusTone(status: ChargeStatus): 'default' | 'success' | 'warning' | 'danger' {
  const tones: Record<ChargeStatus, 'default' | 'success' | 'warning' | 'danger'> = {
    pending: 'warning',
    paid: 'success',
    overdue: 'danger',
    cancelled: 'default',
  };
  return tones[status];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending_review: 'En revisión',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  };
  return labels[status];
}
