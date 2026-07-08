import type { MaintenanceTicketCategory, MaintenanceTicketStatus } from './constants';

export const TICKET_STATUS_LABELS: Record<MaintenanceTicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

export const TICKET_STATUS_TONES: Record<MaintenanceTicketStatus, 'default' | 'warning' | 'success' | 'muted'> = {
  open: 'warning',
  in_progress: 'default',
  resolved: 'success',
  closed: 'muted',
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
