import { ConfigNav } from '@/components/ConfigNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadStaffTeam } from '@/lib/load-team';

import { TeamManager } from './TeamManager';

export default async function EquipoConfigPage() {
  const [session, team] = await Promise.all([loadAdminSession(), loadStaffTeam()]);

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Configuración"
        highlight="del equipo"
        subtitle="Staff administrativo, seguridad y mantenimiento."
        help={<p>{HELP.equipo}</p>}
      />
      <ConfigNav />
      <TeamManager
        members={team.members}
        invitations={team.invitations}
        currentUserId={session.userId}
      />
    </div>
  );
}
