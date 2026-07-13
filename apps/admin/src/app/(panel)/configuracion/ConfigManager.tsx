'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { CondominiumForm } from '@/app/(panel)/configuracion/condominio/CondominiumForm';
import { TeamManager } from '@/app/(panel)/configuracion/equipo/TeamManager';
import { InvitationsPanel } from '@/app/(panel)/configuracion/invitaciones/InvitationsPanel';
import { ProfileForm } from '@/app/(panel)/configuracion/perfil/ProfileForm';
import { UnitsManager } from '@/app/(panel)/configuracion/unidades/UnitsManager';
import { GlassCard } from '@/components/ui/GlassCard';
import { HelpHint } from '@/components/ui/HelpHint';
import type { AdminSession } from '@/lib/load-admin-session';
import type { ClusterRow, CondominiumData, UnitRow } from '@/lib/load-condominium';
import type { ManualDirectoryEntry } from '@/lib/load-manual-directory';
import type { StaffInvitation, TeamMember } from '@/lib/load-team';
import { HELP } from '@/lib/help-content';

type ConfigTab = 'condominio' | 'unidades' | 'invitaciones' | 'equipo' | 'perfil';

const ADMIN_TABS: { id: ConfigTab; label: string; step?: number }[] = [
  { id: 'condominio', label: 'Condominio', step: 1 },
  { id: 'unidades', label: 'Unidades', step: 2 },
  { id: 'invitaciones', label: 'Invitaciones', step: 3 },
  { id: 'equipo', label: 'Equipo', step: 4 },
  { id: 'perfil', label: 'Mi perfil' },
];

const RESIDENT_TABS: { id: ConfigTab; label: string; step?: number }[] = [
  { id: 'perfil', label: 'Mi perfil' },
];

const TAB_HELP: Record<ConfigTab, string> = {
  condominio: HELP.condominio,
  unidades: HELP.unidades,
  invitaciones: HELP.invitaciones,
  equipo: HELP.equipo,
  perfil: 'Tu nombre, foto, teléfono y preferencia de apariencia en el panel.',
};

function normalizeTab(raw: string | null, isAdmin: boolean): ConfigTab {
  const value = (raw ?? '').toLowerCase();
  if (!isAdmin) return 'perfil';
  if (value === 'condominio' || value === 'unidades' || value === 'invitaciones' || value === 'equipo' || value === 'perfil') {
    return value;
  }
  return 'condominio';
}

export function ConfigManager({
  session,
  isAdmin,
  condominium,
  clusters,
  units,
  teamMembers,
  teamInvitations,
  manualStaff,
}: {
  session: AdminSession;
  isAdmin: boolean;
  condominium: CondominiumData | null;
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

  const setupSteps = ADMIN_TABS.filter((item) => item.step != null);

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
              {item.step != null ? (
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                  {item.step}
                </span>
              ) : null}
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {isAdmin ? (
            <p className="text-xs text-muted">
              Flujo recomendado:{' '}
              {setupSteps.map((item, index) => (
                <span key={item.id}>
                  <button
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={
                      tab === item.id
                        ? 'font-semibold text-accent'
                        : 'text-muted hover:text-[var(--text)]'
                    }
                  >
                    {item.label}
                  </button>
                  {index < setupSteps.length - 1 ? ' → ' : ''}
                </span>
              ))}
            </p>
          ) : (
            <span />
          )}
          <HelpHint label="Ayuda de esta pestaña">
            <p>{TAB_HELP[tab]}</p>
          </HelpHint>
        </div>
      </GlassCard>

      {tab === 'condominio' && isAdmin ? (
        condominium ? (
          <CondominiumForm condo={condominium} />
        ) : (
          <GlassCard>
            <p className="text-sm text-muted">Selecciona un condominio activo para editar sus datos.</p>
          </GlassCard>
        )
      ) : null}

      {tab === 'unidades' && isAdmin ? <UnitsManager clusters={clusters} units={units} /> : null}

      {tab === 'invitaciones' && isAdmin ? (
        session.activeCondominiumId ? (
          <InvitationsPanel
            condominiumId={session.activeCondominiumId}
            condominiumName={session.membership?.condominium_name ?? condominium?.name ?? 'Condominio'}
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

      {tab === 'perfil' ? <ProfileForm session={session} /> : null}
    </div>
  );
}
