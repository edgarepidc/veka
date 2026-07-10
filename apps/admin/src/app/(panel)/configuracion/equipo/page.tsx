import { ConfigNav } from '@/components/ConfigNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadStaffTeam } from '@/lib/load-team';
import { loadManualDirectoryEntries } from '@/lib/load-manual-directory';

import { TeamManager } from './TeamManager';

export default async function EquipoConfigPage() {
  const session = await loadAdminSession();
  if (!session) return null;

  const [team, manualEntries] = await Promise.all([
    loadStaffTeam(),
    loadManualDirectoryEntries(session.activeCondominiumId ?? undefined),
  ]);
  const manualStaff = manualEntries.filter((entry) => entry.entryKind === 'staff');

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Configuración"
        highlight="del equipo"
        subtitle="Usuarios con rol en la app: staff admin, mantenimiento y seguridad. El directorio público y el comité de vigilancia están en Comunidad → Mi comunidad."
        help={<p>{HELP.equipo}</p>}
      />
      <ConfigNav />
      <TeamManager
        members={team.members}
        invitations={team.invitations}
        currentUserId={session.userId}
        manualStaff={manualStaff}
      />
    </div>
  );
}
