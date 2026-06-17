'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/client';

const DEMO_CONDO_ID = '22222222-2222-2222-2222-222222222222';

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

export default function ConfiguracionPage() {
  const supabase = createClient();
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [email, setEmail] = useState('');
  const [unitId, setUnitId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    const res = await fetch(`/api/invitations?condominiumId=${DEMO_CONDO_ID}`);
    const data = await res.json();
    setInvitations(data.invitations ?? []);
  }, []);

  useEffect(() => {
    void supabase
      .from('units')
      .select('id, identifier')
      .eq('condominium_id', DEMO_CONDO_ID)
      .then(({ data }) => setUnits((data as UnitOption[]) ?? []));

    void loadInvitations();
  }, [loadInvitations, supabase]);

  async function sendInvitation(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        condominiumId: DEMO_CONDO_ID,
        unitId: unitId || undefined,
        role: 'resident',
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
    setMessage(`Invitación enviada a ${data.invitation.email}`);
    void loadInvitations();
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
          ← Volver al panel
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-slate-900">Configuración</h1>
        <p className="mt-2 text-slate-600">
          Invita residentes por correo. Al registrarse en la app móvil con ese email, se vinculan
          automáticamente a su unidad.
        </p>

        <form
          onSubmit={sendInvitation}
          className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Nueva invitación</h2>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@residente.com"
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
          />
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="">Sin unidad (admin)</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.identifier}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? 'Enviando…' : 'Crear invitación'}
          </button>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        </form>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Invitaciones</h2>
          <ul className="mt-4 space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm"
              >
                <span>
                  {inv.email} · {inv.unit?.identifier ?? 'Sin unidad'}
                </span>
                <span className="capitalize text-slate-500">{inv.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
