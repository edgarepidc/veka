import type { MaintenanceTicketStatus } from '@veka/shared';

import type { TagTone } from '@/constants/theme';
import type { SurfaceAccentTone } from '@/constants/surface';

export function ticketAccentTone(status: MaintenanceTicketStatus): SurfaceAccentTone {
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

export function ticketTagTone(status: MaintenanceTicketStatus): TagTone {
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
}): SurfaceAccentTone {
  if (visit.checked_out_at) return 'purple';
  if (visit.checked_in_at) return 'green';
  if (new Date(visit.valid_until).getTime() < Date.now()) return 'orange';
  return 'blue';
}

export function visitTagTone(visit: {
  checked_in_at: string | null;
  checked_out_at: string | null;
  valid_until: string;
}): TagTone {
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

export function packageAccentTone(status: 'received' | 'delivered' | 'returned'): SurfaceAccentTone {
  if (status === 'received') return 'orange';
  if (status === 'delivered') return 'green';
  return 'purple';
}

export function packageTagTone(status: 'received' | 'delivered' | 'returned'): TagTone {
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
): SurfaceAccentTone {
  if (status === 'pending') return 'orange';
  if (status === 'confirmed') return 'green';
  if (status === 'completed') return 'purple';
  return 'purple';
}

export function reservationTagTone(
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
): TagTone {
  if (status === 'pending') return 'orange';
  if (status === 'confirmed') return 'green';
  if (status === 'completed') return 'gray';
  return 'gray';
}

/** Maintenance routine cards: green when period evidence exists, otherwise muted surface. */
export function routineCardVariant(
  hasEvidenceInPeriod: boolean,
): 'accent' | 'muted' {
  return hasEvidenceInPeriod ? 'accent' : 'muted';
}
