import type {
  MaintenanceTicketBoardStatus,
  MaintenanceTicketCategory,
  MaintenanceTicketStatus,
} from './constants';
import { MAINTENANCE_TICKET_BOARD_STATUSES } from './constants';

export const TICKET_STATUS_LABELS: Record<MaintenanceTicketStatus, string> = {
  open: 'Por iniciar',
  in_progress: 'En progreso',
  resolved: 'Hecho',
  closed: 'Hecho',
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

export function ticketAgeInDays(createdAt: string, now = new Date()): number {
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / (24 * 60 * 60 * 1000)));
}

/** Compact SLA / age chip for boards and lists. */
export function ticketAgeLabel(
  createdAt: string,
  status: MaintenanceTicketStatus,
  now = new Date(),
): string {
  const days = ticketAgeInDays(createdAt, now);
  const board = ticketBoardStatus(status);
  if (board === 'resolved') {
    if (days === 0) return 'Hecho hoy';
    if (days === 1) return 'Hecho ayer';
    return `Hecho hace ${days} d`;
  }
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Hace 1 d';
  return `Hace ${days} d`;
}

export type TicketAgeUrgency = 'ok' | 'watch' | 'late' | 'done';

export function ticketAgeUrgency(
  createdAt: string,
  status: MaintenanceTicketStatus,
  now = new Date(),
): TicketAgeUrgency {
  if (ticketBoardStatus(status) === 'resolved') return 'done';
  const days = ticketAgeInDays(createdAt, now);
  if (days >= 7) return 'late';
  if (days >= 3) return 'watch';
  return 'ok';
}

export function matchesMaintenanceTicketSearch(
  ticket: {
    title: string;
    description: string | null;
    admin_notes: string | null;
    category: MaintenanceTicketCategory;
    unit?: { identifier: string } | null;
    amenity?: { name: string } | null;
  },
  query: string,
  categoryFilter: string,
): boolean {
  if (categoryFilter && ticket.category !== categoryFilter) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    ticket.title,
    ticket.description ?? '',
    ticket.admin_notes ?? '',
    ticket.unit?.identifier ?? '',
    ticket.amenity?.name ?? '',
    ticketCategoryLabel(ticket.category),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function maintenanceTicketPushCopy(
  status: MaintenanceTicketBoardStatus,
  ticketTitle: string,
): { title: string; body: string } {
  if (status === 'resolved') {
    return {
      title: 'Tu reporte está hecho — Veka',
      body: `«${ticketTitle}» quedó resuelto. Toca para ver el detalle.`,
    };
  }
  if (status === 'in_progress') {
    return {
      title: 'Estamos en ello — Veka',
      body: `«${ticketTitle}» pasó a En progreso. Toca para ver el seguimiento.`,
    };
  }
  return {
    title: 'Actualización de mantenimiento — Veka',
    body: `«${ticketTitle}» está Por iniciar. Toca para abrir el reporte.`,
  };
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
