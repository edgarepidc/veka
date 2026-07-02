'use client';

import { useCallback, useEffect, useState } from 'react';

import { MEMBERSHIP_ROLES, type MembershipRole } from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';

const ROLE_LABELS: Record<MembershipRole, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia',
  staff: 'Personal',
};

const INVITE_ROLES = MEMBERSHIP_ROLES.filter((r) => r !== 'super_admin');

interface UnitOption {
  id: string;
  identifier: string;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  unit: { identifier: string } | null;
}

export function InvitationsPanel({
  condominiumId,
  condominiumName,
}: {
  condominiumId: string;
  condominiumName: string;
}) {
  const supabase = createClient();
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [email, setEmail] = useState('');
  const [unitId, setUnitId] = useState('');
  const [role, setRole] = useState<MembershipRole>('resident');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    const res = await fetch(`/api/invitations?condominiumId=${condominiumId}`);
    const data = await res.json();
    setInvitations(data.invitations ?? []);
  }, [condominiumId]);

  useEffect(() => {
    void supabase
      .from('units')
      .select('id, identifier')
      .eq('condominium_id', condominiumId)
      .then(({ data }) => setUnits((data as UnitOption[]) ?? []));

    void loadInvitations();
  }, [condominiumId, loadInvitations, supabase]);

  async function sendInvitation(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        condominiumId,
        unitId: unitId || undefined,
        role,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? 'No se pudo crear la invitación');
      return;
    }

    setEmail('');
    setUnitId('');
    const emailNote = data.emailSent ? ' Se envió el correo de invitación.' : ' (correo no enviado: revisa RESEND_API_KEY)';
    setMessage(`Invitación creada para ${data.invitation.email}.${emailNote}`);
    void loadInvitations();
  }

  return (
    <>
      <GlassCard className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text)]">Nueva invitación</h2>
        <p className="mt-1 text-sm text-muted">
          Invita a alguien a <strong>{condominiumName}</strong>. Recibirá un correo para registrarse con el mismo email.
        </p>
        <form onSubmit={sendInvitation} className="mt-4 space-y-3">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@usuario.com"
            className="glass-input"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as MembershipRole)} className="glass-input">
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r} className="bg-slate-900">
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {role === 'resident' || role === 'board_member' ? (
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="glass-input">
              <option value="" className="bg-slate-900">
                Selecciona unidad
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id} className="bg-slate-900">
                  {unit.identifier}
                </option>
              ))}
            </select>
          ) : null}
          <button type="submit" disabled={loading} className="glass-btn-primary">
            {loading ? 'Creando…' : 'Crear invitación'}
          </button>
          {message ? <p className="text-sm text-muted">{message}</p> : null}
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Invitaciones recientes</h2>
        <ul className="mt-4 space-y-2">
          {invitations.length === 0 ? (
            <li className="text-sm text-subtle">No hay invitaciones todavía.</li>
          ) : (
            invitations.map((inv) => (
              <li key={inv.id} className="glass-card-deep flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-[var(--text)]">
                  {inv.email} · {ROLE_LABELS[inv.role as MembershipRole] ?? inv.role}
                  {inv.unit?.identifier ? ` · ${inv.unit.identifier}` : ''}
                </span>
                <span className="glass-tag-green capitalize">{inv.status}</span>
              </li>
            ))
          )}
        </ul>
      </GlassCard>
    </>
  );
}
