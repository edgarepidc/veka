'use client';

import { useMemo, useState, useTransition } from 'react';
import { VIGILANCE_TITLE_OPTIONS } from '@veka/shared';

import {
  addCommitteeMember,
  removeCommitteeMember,
} from '@/app/(panel)/comunidad/committee-actions';
import type { CommitteeMemberRow, ResidentDirectoryRow } from '@/lib/load-committee';

export function VigilanceCommitteePanel({
  condominiumId,
  clusterId,
  clusterLabel,
  residents,
  members,
}: {
  condominiumId: string;
  clusterId: string;
  clusterLabel: string;
  residents: ResidentDirectoryRow[];
  members: CommitteeMemberRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [membershipId, setMembershipId] = useState('');
  const [title, setTitle] = useState<string>(VIGILANCE_TITLE_OPTIONS[0]);

  const memberIds = useMemo(() => new Set(members.map((row) => row.membershipId)), [members]);

  const availableResidents = useMemo(
    () => residents.filter((row) => !memberIds.has(row.membershipId)),
    [memberIds, residents],
  );

  const visibleMembers = useMemo(
    () => (clusterId ? members.filter((row) => row.clusterId === clusterId) : members),
    [clusterId, members],
  );

  function runAdd(formData: FormData) {
    setMessage(null);
    start(async () => {
      const result = await addCommitteeMember(formData);
      setMessage(result.error ?? 'Integrante agregado al comité.');
      if (!result.error) {
        setMembershipId('');
        setTitle(VIGILANCE_TITLE_OPTIONS[0]);
      }
    });
  }

  function runRemove(id: string) {
    if (!confirm('¿Quitar a esta persona del comité de vigilancia?')) return;
    setMessage(null);
    start(async () => {
      const result = await removeCommitteeMember(id);
      setMessage(result.error ?? 'Integrante removido.');
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--text)]">Comité de vigilancia</h3>
        <p className="mt-1 text-sm text-muted">
          Vecinos que vigilan el actuar de la administración. Se eligen del directorio de residentes
          (sin invitación nueva) · {clusterLabel}.
        </p>
      </div>

      <form action={runAdd} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <input type="hidden" name="condominium_id" value={condominiumId} />
        <input type="hidden" name="committee_kind" value="vigilance" />
        <select
          name="membership_id"
          required
          value={membershipId}
          onChange={(event) => setMembershipId(event.target.value)}
          className="glass-input"
        >
          <option value="" className="bg-slate-900">
            Selecciona residente…
          </option>
          {availableResidents.map((resident) => (
            <option key={resident.membershipId} value={resident.membershipId} className="bg-slate-900">
              {resident.fullName}
              {resident.unitIdentifier ? ` · ${resident.unitIdentifier}` : ''}
              {resident.clusterName ? ` · ${resident.clusterName}` : ''}
              {` · ${resident.roleLabel}`}
            </option>
          ))}
        </select>
        <select
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="glass-input"
        >
          {VIGILANCE_TITLE_OPTIONS.map((option) => (
            <option key={option} value={option} className="bg-slate-900">
              {option}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending || availableResidents.length === 0} className="glass-btn-primary">
          {pending ? 'Agregando…' : 'Agregar'}
        </button>
      </form>

      {availableResidents.length === 0 ? (
        <p className="text-xs text-subtle">
          {residents.length === 0
            ? 'No hay residentes registrados en este alcance. Invita residentes desde Unidades.'
            : 'Todos los residentes visibles ya están en el comité (o no hay más candidatos).'}
        </p>
      ) : null}

      <ul className="space-y-2">
        {visibleMembers.length === 0 ? (
          <li className="text-sm text-subtle">Sin integrantes en el comité para este alcance.</li>
        ) : (
          visibleMembers.map((member) => (
            <li
              key={member.id}
              className="glass-card-deep flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{member.fullName}</p>
                <p className="text-xs text-subtle">
                  Cargo: {member.title} · Perfil: {member.roleLabel}
                  {member.unitIdentifier ? ` · Vivienda ${member.unitIdentifier}` : ''}
                  {member.clusterName ? ` · ${member.clusterName}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => runRemove(member.id)}
                className="glass-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                Quitar
              </button>
            </li>
          ))
        )}
      </ul>

      {message ? (
        <p
          className={`text-sm ${
            message.includes('agregado') || message.includes('removido') ? 'text-accent' : 'text-red-300'
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
