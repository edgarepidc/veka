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

const STAFF_AUTHOR_ROLES = new Set(['super_admin', 'admin', 'board_member', 'staff']);

export function formatCommunityAuthorName(
  fullName: string | null | undefined,
  role: string | null | undefined,
): string {
  const name = fullName?.trim() || 'Residente';
  if (role === 'admin' || role === 'super_admin') return `${name} - Administrador`;
  if (role === 'board_member') return `${name} - Mesa directiva`;
  if (role === 'staff') return `${name} - Staff`;
  return name;
}

export function isStaffCommunityRole(role: string | null | undefined): boolean {
  return role != null && STAFF_AUTHOR_ROLES.has(role);
}

export interface PollOptionVotes {
  id: string;
  label: string;
  votes: number;
}

export interface PollQuorumInput {
  options: PollOptionVotes[];
  totalVotes: number;
  eligibleVoters: number;
  quorumPercent?: number | null;
  isFormal: boolean;
  isClosed: boolean;
}

export interface PollQuorumResult {
  quorumRequired: boolean;
  quorumMet: boolean | null;
  participationPercent: number;
  winningOption: { label: string; votes: number; percent: number } | null;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'neutral';
}

export function computePollQuorumResult(input: PollQuorumInput): PollQuorumResult {
  const { options, totalVotes, eligibleVoters, quorumPercent, isFormal, isClosed } = input;
  const participationPercent =
    eligibleVoters > 0
      ? Math.min(100, Math.round((totalVotes / eligibleVoters) * 100))
      : 0;

  const winning =
    options.length > 0
      ? options.reduce((best, opt) => (opt.votes > best.votes ? opt : best), options[0])
      : null;

  const winningOption =
    winning && winning.votes > 0
      ? {
          label: winning.label,
          votes: winning.votes,
          percent: totalVotes > 0 ? Math.round((winning.votes / totalVotes) * 100) : 0,
        }
      : null;

  const quorumRequired = isFormal && quorumPercent != null && quorumPercent > 0;
  const quorumMet = quorumRequired ? participationPercent >= quorumPercent! : null;

  if (!isClosed) {
    return {
      quorumRequired,
      quorumMet,
      participationPercent,
      winningOption,
      statusLabel: quorumRequired
        ? `Participación ${participationPercent}% · quórum ${quorumPercent}%`
        : `Participación ${participationPercent}%`,
      statusTone: 'neutral',
    };
  }

  if (!quorumRequired) {
    return {
      quorumRequired: false,
      quorumMet: null,
      participationPercent,
      winningOption,
      statusLabel: winningOption
        ? `Resultado: ${winningOption.label} (${winningOption.percent}%)`
        : 'Sin votos registrados',
      statusTone: winningOption ? 'success' : 'neutral',
    };
  }

  if (!quorumMet) {
    return {
      quorumRequired: true,
      quorumMet: false,
      participationPercent,
      winningOption,
      statusLabel: `Sin quórum (${participationPercent}% de ${quorumPercent}% requerido)`,
      statusTone: 'warning',
    };
  }

  return {
    quorumRequired: true,
    quorumMet: true,
    participationPercent,
    winningOption,
    statusLabel: winningOption
      ? `Aprobada: ${winningOption.label} (${winningOption.percent}% de votos)`
      : 'Quórum alcanzado sin votos',
    statusTone: 'success',
  };
}

export interface PollMinutesExportInput {
  title: string;
  body?: string | null;
  isFormal: boolean;
  createdAt: string;
  pollClosesAt?: string | null;
  pollClosedAt?: string | null;
  quorumPercent?: number | null;
  options: PollOptionVotes[];
  totalVotes: number;
  eligibleVoters: number;
}

export function formatPollMinutesExport(input: PollMinutesExportInput): string {
  const result = computePollQuorumResult({
    options: input.options,
    totalVotes: input.totalVotes,
    eligibleVoters: input.eligibleVoters,
    quorumPercent: input.quorumPercent,
    isFormal: input.isFormal,
    isClosed: true,
  });

  const lines: string[] = [
    'RESUMEN DE ENCUESTA — VEKA',
    '═'.repeat(40),
    `Título: ${input.title}`,
    input.body ? `Contexto: ${input.body}` : '',
    `Tipo: ${input.isFormal ? 'Formal (propietarios)' : 'Informal'}`,
    `Publicada: ${new Date(input.createdAt).toLocaleString('es-MX')}`,
    input.pollClosedAt
      ? `Cerrada: ${new Date(input.pollClosedAt).toLocaleString('es-MX')}`
      : input.pollClosesAt
        ? `Cierre programado: ${new Date(input.pollClosesAt).toLocaleString('es-MX')}`
        : '',
    input.quorumPercent ? `Quórum requerido: ${input.quorumPercent}%` : '',
    `Electores elegibles: ${input.eligibleVoters}`,
    `Participación: ${result.participationPercent}% (${input.totalVotes} voto${input.totalVotes === 1 ? '' : 's'})`,
    `Resultado: ${result.statusLabel}`,
    '',
    'DESGLOSE DE VOTOS',
    '─'.repeat(40),
  ].filter(Boolean);

  for (const opt of input.options) {
    const pct = input.totalVotes > 0 ? Math.round((opt.votes / input.totalVotes) * 100) : 0;
    lines.push(`• ${opt.label}: ${opt.votes} (${pct}%)`);
  }

  lines.push('', `Generado: ${new Date().toLocaleString('es-MX')}`);
  return lines.join('\n');
}
