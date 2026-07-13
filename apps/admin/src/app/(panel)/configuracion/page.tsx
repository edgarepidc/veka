import { Suspense } from 'react';

import { ConfigManager } from '@/app/(panel)/configuracion/ConfigManager';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadClustersAndUnits } from '@/lib/load-condominium';
import { loadManualDirectoryEntries } from '@/lib/load-manual-directory';
import { loadStaffTeam } from '@/lib/load-team';

export default async function ConfiguracionPage() {
  const session = await loadAdminSession();
  if (!session) return null;

  const isAdmin = session.isAdmin;
  const condominiumId = session.activeCondominiumId;

  const [unitsBundle, team, manualEntries] = await Promise.all([
    isAdmin ? loadClustersAndUnits() : Promise.resolve({ clusters: [], units: [] }),
    isAdmin ? loadStaffTeam() : Promise.resolve({ members: [], invitations: [] }),
    isAdmin && condominiumId
      ? loadManualDirectoryEntries(condominiumId)
      : Promise.resolve([]),
  ]);

  const manualStaff = manualEntries.filter((entry) => entry.entryKind === 'staff');

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Configuración"
        highlight={isAdmin ? 'administrativa' : 'personal'}
        subtitle={
          isAdmin
            ? 'Unidades, invitaciones y equipo del condominio activo.'
            : 'Tu perfil y preferencias de acceso.'
        }
        help={
          <p>
            {isAdmin
              ? 'Organiza torres y vecinos, invita accesos y define el equipo operativo. La marca del condominio se edita en Platform.'
              : 'Actualiza tu perfil, apariencia y contraseña de acceso.'}
          </p>
        }
      />
      <Suspense
        fallback={
          <GlassCard>
            <p className="text-sm text-muted">Cargando configuración…</p>
          </GlassCard>
        }
      >
        <ConfigManager
          session={session}
          isAdmin={isAdmin}
          clusters={unitsBundle.clusters}
          units={unitsBundle.units}
          teamMembers={team.members}
          teamInvitations={team.invitations}
          manualStaff={manualStaff}
        />
      </Suspense>
    </div>
  );
}
