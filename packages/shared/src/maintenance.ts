import type {
  MaintenanceTicketBoardStatus,
  MaintenanceTicketCategory,
  MaintenanceTicketStatus,
} from './constants';
import { MAINTENANCE_TICKET_BOARD_STATUSES } from './constants';

export const TICKET_STATUS_LABELS: Record<MaintenanceTicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  resolved: 'Resuelto',
  closed: 'Resuelto',
};

export const TICKET_STATUS_TONES: Record<MaintenanceTicketStatus, 'default' | 'warning' | 'success' | 'muted'> = {
  open: 'warning',
  in_progress: 'default',
  resolved: 'success',
  closed: 'success',
};

export const TICKET_CATEGORY_LABELS: Record<MaintenanceTicketCategory, string> = {
  unit: 'Mi unidad',
  common_area: 'Área común',
  plumbing: 'Plomería / fugas',
  electrical: 'Eléctrico',
  equipment: 'Equipo / instalación',
  other: 'Otro',
};

export function ticketStatusLabel(status: MaintenanceTicketStatus): string {
  return TICKET_STATUS_LABELS[status];
}

export function ticketCategoryLabel(category: MaintenanceTicketCategory): string {
  return TICKET_CATEGORY_LABELS[category];
}

/** Normalize legacy `closed` into the active board column `resolved`. */
export function ticketBoardStatus(status: MaintenanceTicketStatus): MaintenanceTicketBoardStatus {
  if (status === 'closed') return 'resolved';
  if ((MAINTENANCE_TICKET_BOARD_STATUSES as readonly string[]).includes(status)) {
    return status as MaintenanceTicketBoardStatus;
  }
  return 'open';
}

export type MaintenanceTicketFilter = 'active' | 'open' | 'closed' | 'all';

export function matchesMaintenanceTicketFilter(
  status: MaintenanceTicketStatus,
  filter: MaintenanceTicketFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return status === 'open' || status === 'in_progress';
  if (filter === 'open') return status === 'open';
  if (filter === 'closed') return status === 'resolved' || status === 'closed';
  return true;
}
