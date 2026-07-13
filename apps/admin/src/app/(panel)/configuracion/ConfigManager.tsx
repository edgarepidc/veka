'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { TeamManager } from '@/app/(panel)/configuracion/equipo/TeamManager';
import { InvitationsPanel } from '@/app/(panel)/configuracion/invitaciones/InvitationsPanel';
import { ProfileForm } from '@/app/(panel)/configuracion/perfil/ProfileForm';
import { UnitsManager } from '@/app/(panel)/configuracion/unidades/UnitsManager';
import { GlassCard } from '@/components/ui/GlassCard';
import { HelpHint } from '@/components/ui/HelpHint';
import type { AdminSession } from '@/lib/load-admin-session';
import type { ClusterRow, UnitRow } from '@/lib/load-condominium';
import type { ManualDirectoryEntry } from '@/lib/load-manual-directory';
import type { StaffInvitation, TeamMember } from '@/lib/load-team';
import { HELP } from '@/lib/help-content';

type ConfigTab = 'perfil' | 'unidades' | 'invitaciones' | 'equipo';

const ADMIN_TABS: { id: ConfigTab; label: string }[] = [
  { id: 'perfil', label: 'Mi perfil' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'invitaciones', label: 'Invitaciones' },
  { id: 'equipo', label: 'Equipo' },
];

const RESIDENT_TABS: { id: ConfigTab; label: string }[] = [{ id: 'perfil', label: 'Mi perfil' }];

const TAB_HELP: Record<ConfigTab, string> = {
  perfil: 'Tu nombre, foto, teléfono y preferencia de apariencia en el panel.',
  unidades: HELP.unidades,
  invitaciones: HELP.invitaciones,
  equipo: HELP.equipo,
};

function normalizeTab(raw: string | null, isAdmin: boolean): ConfigTab {
  const value = (raw ?? '').toLowerCase();
  if (!isAdmin) return 'perfil';
  if (value === 'perfil' || value === 'unidades' || value === 'invitaciones' || value === 'equipo') {
    return value;
  }
  return 'perfil';
}

export function ConfigManager({
  session,
  isAdmin,
  clusters,
  units,
  teamMembers,
  teamInvitations,
  manualStaff,
}: {
  session: AdminSession;
  isAdmin: boolean;
  clusters: ClusterRow[];
  units: UnitRow[];
  teamMembers: TeamMember[];
  teamInvitations: StaffInvitation[];
  manualStaff: ManualDirectoryEntry[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = isAdmin ? ADMIN_TABS : RESIDENT_TABS;
  const tab = useMemo(
    () => normalizeTab(searchParams.get('tab'), isAdmin),
    [isAdmin, searchParams],
  );

  function setTab(next: ConfigTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      <GlassCard className="!p-3">
        <div className="glass-tab-strip">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`glass-tab ${tab === item.id ? 'glass-tab-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex justify-end">
          <HelpHint label="Ayuda de esta pestaña">
            <p>{TAB_HELP[tab]}</p>
          </HelpHint>
        </div>
      </GlassCard>

      {tab === 'perfil' ? <ProfileForm session={session} /> : null}

      {tab === 'unidades' && isAdmin ? <UnitsManager clusters={clusters} units={units} /> : null}

      {tab === 'invitaciones' && isAdmin ? (
        session.activeCondominiumId ? (
          <InvitationsPanel
            condominiumId={session.activeCondominiumId}
            condominiumName={session.membership?.condominium_name ?? 'Condominio'}
          />
        ) : (
          <GlassCard>
            <p className="text-sm text-muted">Sin condominio activo para enviar invitaciones.</p>
          </GlassCard>
        )
      ) : null}

      {tab === 'equipo' && isAdmin ? (
        <TeamManager
          members={teamMembers}
          invitations={teamInvitations}
          currentUserId={session.userId}
          manualStaff={manualStaff}
        />
      ) : null}
    </div>
  );
}
