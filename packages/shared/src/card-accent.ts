import type { ChargeStatus, ExpenseStatus, MaintenanceTicketStatus, PaymentStatus } from './constants';

export type CardAccentTone = 'blue' | 'green' | 'orange' | 'purple' | 'danger';
export type CardTagTone = 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'gray';

export function ticketAccentTone(status: MaintenanceTicketStatus): CardAccentTone {
  switch (status) {
    case 'open':
      return 'orange';
    case 'in_progress':
      return 'blue';
    case 'resolved':
      return 'green';
    case 'closed':
      return 'purple';
    default:
      return 'blue';
  }
}

export function ticketTagTone(status: MaintenanceTicketStatus): CardTagTone {
  switch (status) {
    case 'open':
      return 'orange';
    case 'in_progress':
      return 'blue';
    case 'resolved':
      return 'green';
    case 'closed':
      return 'gray';
    default:
      return 'gray';
  }
}

export function visitAccentTone(visit: {
  checked_in_at: string | null;
  checked_out_at: string | null;
  valid_until: string;
}): CardAccentTone {
  if (visit.checked_out_at) return 'purple';
  if (visit.checked_in_at) return 'green';
  if (new Date(visit.valid_until).getTime() < Date.now()) return 'orange';
  return 'blue';
}

export function visitTagTone(visit: {
  checked_in_at: string | null;
  checked_out_at: string | null;
  valid_until: string;
}): CardTagTone {
  if (visit.checked_out_at) return 'gray';
  if (visit.checked_in_at) return 'green';
  if (new Date(visit.valid_until).getTime() < Date.now()) return 'orange';
  return 'blue';
}

export function visitStatusLabel(
  visit: {
    checked_in_at: string | null;
    checked_out_at: string | null;
    valid_until: string;
  },
  options?: { activeLabel?: string },
): string {
  if (visit.checked_out_at) return 'Salió';
  if (visit.checked_in_at) return 'Dentro';
  if (new Date(visit.valid_until).getTime() < Date.now()) return 'Expirado';
  return options?.activeLabel ?? 'Activo';
}

export function packageAccentTone(status: 'received' | 'delivered' | 'returned'): CardAccentTone {
  if (status === 'received') return 'orange';
  if (status === 'delivered') return 'green';
  return 'purple';
}

export function packageTagTone(status: 'received' | 'delivered' | 'returned'): CardTagTone {
  if (status === 'received') return 'orange';
  if (status === 'delivered') return 'green';
  return 'gray';
}

export function packageStatusLabel(status: 'received' | 'delivered' | 'returned'): string {
  if (status === 'received') return 'En caseta';
  if (status === 'delivered') return 'Entregado';
  return 'Devuelto';
}

export function reservationAccentTone(
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
): CardAccentTone {
  if (status === 'pending') return 'orange';
  if (status === 'confirmed') return 'green';
  if (status === 'completed') return 'purple';
  return 'purple';
}

export function reservationTagTone(
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
): CardTagTone {
  if (status === 'pending') return 'orange';
  if (status === 'confirmed') return 'green';
  if (status === 'completed') return 'gray';
  return 'gray';
}

export function routineCardVariant(hasEvidenceInPeriod: boolean): 'accent' | 'muted' {
  return hasEvidenceInPeriod ? 'accent' : 'muted';
}

export function chargeAccentTone(status: ChargeStatus): CardAccentTone {
  if (status === 'overdue') return 'danger';
  if (status === 'pending') return 'orange';
  if (status === 'paid') return 'green';
  return 'purple';
}

export function chargeTagTone(status: ChargeStatus): CardTagTone {
  if (status === 'overdue') return 'red';
  if (status === 'pending') return 'orange';
  if (status === 'paid') return 'green';
  return 'gray';
}

export function expenseAccentTone(status: ExpenseStatus): CardAccentTone {
  if (status === 'paid') return 'green';
  if (status === 'pending') return 'orange';
  return 'purple';
}

export function expenseTagTone(status: ExpenseStatus): CardTagTone {
  if (status === 'paid') return 'green';
  if (status === 'pending') return 'orange';
  return 'gray';
}

export function paymentAccentTone(status: PaymentStatus): CardAccentTone {
  if (status === 'rejected') return 'danger';
  if (status === 'approved') return 'green';
  if (status === 'pending_review' || status === 'pending_second_review') return 'orange';
  return 'blue';
}

export function paymentTagTone(status: PaymentStatus): CardTagTone {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'pending_review' || status === 'pending_second_review') return 'orange';
  return 'blue';
}

export function cardTagClass(tone: CardTagTone): string {
  switch (tone) {
    case 'green':
      return 'glass-tag-green';
    case 'blue':
      return 'glass-tag-blue';
    case 'orange':
      return 'glass-tag-amber';
    case 'red':
      return 'glass-tag-red';
    case 'purple':
      return 'glass-tag-purple';
    case 'gray':
    default:
      return 'glass-tag-gray';
  }
}
