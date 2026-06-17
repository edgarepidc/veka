import { ConfigNav } from '@/components/ConfigNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadTeamMembers } from '@/lib/load-team';

import { TeamManager } from './TeamManager';

export default async function EquipoConfigPage() {
  const [session, members] = await Promise.all([loadAdminSession(), loadTeamMembers()]);

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Configuración"
        highlight="del equipo"
        subtitle="Roles y permisos de administradores, guardias y personal."
      />
      <ConfigNav />
      <TeamManager members={members} currentUserId={session.userId} />
    </div>
  );
}
