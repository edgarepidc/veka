export interface PollCloseFields {
  poll_closes_at?: string | null;
  poll_closed_at?: string | null;
}

export function isPollClosed(poll: PollCloseFields): boolean {
  if (poll.poll_closed_at) return true;
  if (!poll.poll_closes_at) return false;
  return new Date(poll.poll_closes_at).getTime() <= Date.now();
}

export function pollCloseLabel(poll: PollCloseFields): string | null {
  if (poll.poll_closed_at) return 'Cerrada por administración';
  if (poll.poll_closes_at && isPollClosed(poll)) {
    return `Cerrada el ${new Date(poll.poll_closes_at).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  if (poll.poll_closes_at) {
    return `Cierra el ${new Date(poll.poll_closes_at).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  return null;
}
