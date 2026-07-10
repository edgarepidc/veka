export const ASSEMBLY_STATUSES = ['draft', 'scheduled', 'held', 'closed'] as const;
export type AssemblyStatus = (typeof ASSEMBLY_STATUSES)[number];

export const ASSEMBLY_STATUS_LABELS: Record<AssemblyStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  held: 'Celebrada',
  closed: 'Cerrada',
};

export function isAssemblyStatus(value: string): value is AssemblyStatus {
  return (ASSEMBLY_STATUSES as readonly string[]).includes(value);
}

/** Ticket statuses that mark a linked agreement as done. */
export function isTicketDoneStatus(status: string | null | undefined): boolean {
  return status === 'resolved' || status === 'closed';
}
