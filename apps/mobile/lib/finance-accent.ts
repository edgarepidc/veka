import type { ChargeStatus, PaymentStatus } from '@veka/shared';

import type { SurfaceAccentTone } from '@/constants/surface';

export function chargeAccentTone(status: ChargeStatus): SurfaceAccentTone {
  if (status === 'overdue') return 'danger';
  if (status === 'pending') return 'orange';
  if (status === 'paid') return 'green';
  return 'purple';
}

export function paymentAccentTone(status: PaymentStatus): SurfaceAccentTone {
  if (status === 'rejected') return 'danger';
  if (status === 'approved') return 'green';
  if (status === 'pending_review' || status === 'pending_second_review') return 'orange';
  return 'blue';
}

export function expenseAccentTone(status: string): SurfaceAccentTone {
  if (status === 'paid') return 'green';
  if (status === 'pending') return 'orange';
  return 'purple';
}
