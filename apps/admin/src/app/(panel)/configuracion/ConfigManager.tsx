'use client';

import { matchesClusterResourceScope } from '@veka/shared';
import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { TeamManager } from '@/app/(panel)/configuracion/equipo/TeamManager';
import { InvitationsPanel } from '@/app/(panel)/configuracion/invitaciones/InvitationsPanel';
import { ProfileForm } from '@/app/(panel)/configuracion/perfil/ProfileForm';
import { UnitsManager } from '@/app/(panel)/configuracion/unidades/UnitsManager';
import { FinanceScopeFilter } from '@/components/FinanceScopeFilter';
import { GlassCard } from '@/components/ui/GlassCard';
import { HelpHint } from '@/components/ui/HelpHint';
import type { AdminSession } from '@/lib/load-admin-session';
import type { ClusterRow, UnitRow } from '@/lib/load-condominium';
import type { ManualDirectoryEntry } from '@/lib/load-manual-directory';
import type { StaffInvitation, TeamMember } from '@/lib/load-team';
import { HELP } from '@/lib/help-content';

type ConfigTab = 'unidades' | 'invitaciones' | 'equipo' | 'perfil';

const ADMIN_TABS: { id: ConfigTab; label: string }[] = [
  { id: 'unidades', label: 'Unidades' },
  { id: 'invitaciones', label: 'Invitaciones' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'perfil', label: 'Mi perfil' },
];

const RESIDENT_TABS: { id: ConfigTab; label: string }[] = [{ id: 'perfil', label: 'Mi perfil' }];

const TAB_HELP: Record<ConfigTab, string> = {
  unidades: HELP.unidades,
  invitaciones: HELP.invitaciones,
  equipo: HELP.equipo,
  perfil: 'Tu nombre, foto, teléfono y preferencia de apariencia en el panel.',
};

const TAB_FOOTER: Record<ConfigTab, string> = {
  unidades:
    'Crea torres/clusters y unidades. Desde cada unidad puedes invitar propietario o inquilino. La marca y datos generales del condominio se editan en Platform (super admin).',
  invitaciones:
    'Invita por correo con rol y unidad. Las invitaciones de staff también se pueden enviar desde Equipo; las de residentes conviene darlas desde Unidades o aquí.',
  equipo:
    'Gestiona roles de app (admin, mantenimiento, caseta) y el directorio manual. El comité de vigilancia vive en Comunidad → Mi comunidad.',
  perfil: 'Tu perfil personal no cambia la configuración del condominio; solo afecta cómo te ven en el panel y el directorio.',
};

function normalizeTab(raw: string | null, isAdmin: boolean): ConfigTab {
  const value = (raw ?? '').toLowerCase();
  if (!isAdmin) return 'perfil';
  if (value === 'unidades' || value === 'invitaciones' || value === 'equipo' || value === 'perfil') {
    return value;
  }
  return 'unidades';
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
  const [scopeFilter, setScopeFilter] = useState('');
  const tabs = isAdmin ? ADMIN_TABS : RESIDENT_TABS;
  const tab = useMemo(
    () => normalizeTab(searchParams.get('tab'), isAdmin),
    [isAdmin, searchParams],
  );

  const showScope = isAdmin && clusters.length > 0 && (tab === 'unidades' || tab === 'invitaciones');

  const scopedClusters = useMemo(() => {
    if (!scopeFilter) return clusters;
    return clusters.filter((cluster) => cluster.id === scopeFilter);
  }, [clusters, scopeFilter]);

  const scopedUnits = useMemo(
    () => units.filter((unit) => matchesClusterResourceScope(unit.cluster_id, scopeFilter || 'all')),
    [scopeFilter, units],
  );

  function setTab(next: ConfigTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const condominiumId = session.activeCondominiumId ?? '';
  const condominiumName = session.membership?.condominium_name ?? 'Condominio';

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

        {showScope ? (
          <div className="mt-3">
            <FinanceScopeFilter
              condominiums={[{ id: condominiumId || 'condo', name: condominiumName }]}
              clusters={clusters}
              condominiumId={condominiumId || 'condo'}
              clusterId={scopeFilter}
              onCondominiumChange={() => {}}
              onClusterChange={setScopeFilter}
              align="end"
              allLabel="Todo"
            />
          </div>
        ) : null}
      </GlassCard>

      {tab === 'unidades' && isAdmin ? <UnitsManager clusters={scopedClusters} units={scopedUnits} /> : null}

      {tab === 'invitaciones' && isAdmin ? (
        condominiumId ? (
          <InvitationsPanel
            condominiumId={condominiumId}
            condominiumName={condominiumName}
            units={scopedUnits.map((unit) => ({
              id: unit.id,
              identifier: unit.identifier,
              clusterName: unit.cluster?.name ?? null,
            }))}
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

      <GlassCard variant="muted">
        <h2 className="text-sm font-semibold text-[var(--text)]">Cómo funciona</h2>
        <p className="mt-2 text-sm text-muted">{TAB_FOOTER[tab]}</p>
      </GlassCard>
    </div>
  );
}
