'use client';

import { useMemo, useState, useTransition } from 'react';
import { VIGILANCE_TITLE_OPTIONS } from '@veka/shared';

import {
  addCommitteeMember,
  removeCommitteeMember,
} from '@/app/(panel)/comunidad/committee-actions';
import { addManualCommitteeEntry, removeManualDirectoryEntry } from '@/app/(panel)/configuracion/equipo/manual-directory-actions';
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
  const [query, setQuery] = useState('');

  const memberIds = useMemo(() => new Set(members.map((row) => row.membershipId)), [members]);

  const availableResidents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return residents
      .filter((row) => !memberIds.has(row.membershipId))
      .filter((row) => {
        if (!needle) return true;
        const haystack = [
          row.fullName,
          row.unitIdentifier ?? '',
          row.clusterName ?? '',
          row.roleLabel,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
  }, [memberIds, query, residents]);

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
        setQuery('');
      }
    });
  }

  function runManualAdd(formData: FormData) {
    setMessage(null);
    start(async () => {
      const result = await addManualCommitteeEntry(formData);
      setMessage(result.error ?? 'Integrante manual agregado al comité.');
    });
  }

  function runRemove(id: string, isManual?: boolean) {
    if (!confirm('¿Quitar a esta persona del comité de vigilancia?')) return;
    setMessage(null);
    start(async () => {
      const result = isManual ? await removeManualDirectoryEntry(id) : await removeCommitteeMember(id);
      setMessage(result.error ?? 'Integrante removido.');
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--text)]">Comité de vigilancia</h3>
        <p className="mt-1 text-sm text-muted">
          Vecinos del directorio (sin invitación nueva). Busca por nombre, departamento o cluster ·{' '}
          {clusterLabel}.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar residente, depto o cluster…"
        className="glass-input w-full"
      />

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
            {availableResidents.length === 0
              ? 'Sin coincidencias…'
              : 'Selecciona residente…'}
          </option>
          {availableResidents.map((resident) => (
            <option key={resident.membershipId} value={resident.membershipId} className="bg-slate-900">
              {resident.fullName}
              {resident.unitIdentifier ? ` · ${resident.unitIdentifier}` : ''}
              {resident.clusterName ? ` · ${resident.clusterName}` : ' · Condominio general'}
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

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-[var(--text)]">Agregar sin cuenta en la app</p>
        <p className="mt-1 text-xs text-subtle">
          Para integrantes del comité que no tienen usuario en Veka.
        </p>
        <form action={runManualAdd} className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
          <input type="hidden" name="condominium_id" value={condominiumId} />
          <input type="text" name="full_name" required placeholder="Nombre completo" className="glass-input" />
          <select name="committee_title" defaultValue={VIGILANCE_TITLE_OPTIONS[0]} className="glass-input">
            {VIGILANCE_TITLE_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-slate-900">
                {option}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="glass-btn-primary">
            {pending ? 'Agregando…' : 'Agregar'}
          </button>
          <input type="text" name="phone" placeholder="Teléfono (opcional)" className="glass-input sm:col-span-2" />
          <input
            type="text"
            name="unit_identifier"
            placeholder="Depto (opcional)"
            className="glass-input sm:col-span-2"
          />
          <label className="flex items-center gap-2 text-xs text-muted sm:col-span-3">
            <input type="checkbox" name="show_phone" defaultChecked className="h-4 w-4 rounded border-white/20" />
            Mostrar teléfono en Mi comunidad
          </label>
        </form>
      </div>

      {availableResidents.length === 0 ? (
        <p className="text-xs text-subtle">
          {residents.length === 0
            ? 'No hay residentes registrados en este alcance. Invita residentes desde Unidades.'
            : query.trim()
              ? 'Ningún residente coincide con la búsqueda.'
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
                  {member.title}
                  {member.isManual ? ' · Sin cuenta en app' : ''}
                  {member.unitIdentifier ? ` · ${member.unitIdentifier}` : ''}
                  {member.clusterName ? ` · ${member.clusterName}` : ' · Condominio general'}
                  {member.phone ? ` · Tel. ${member.phone}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => runRemove(member.id, member.isManual)}
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
