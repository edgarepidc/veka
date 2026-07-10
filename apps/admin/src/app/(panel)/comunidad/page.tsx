import { CommunityManager } from '@/app/(panel)/comunidad/CommunityManager';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
import { requireAdminSession } from '@/lib/require-admin';
import { loadCommunityDocuments, loadCommunityPosts } from '@/lib/load-community';
import { loadCondominiumClusters } from '@/lib/community-clusters';
import { loadStaffTeam } from '@/lib/load-team';

export default async function ComunidadPage() {
  const session = await requireAdminSession();
  const condominiumId = session.activeCondominiumId;
  if (!condominiumId) return null;

  const [posts, documents, clusters, team] = await Promise.all([
    loadCommunityPosts(condominiumId),
    loadCommunityDocuments(condominiumId),
    loadCondominiumClusters(condominiumId),
    loadStaffTeam(condominiumId),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Comunidad"
        highlight="del condominio"
        subtitle="Avisos, encuestas, documentos y el equipo de trabajo por torre."
        help={
          <>
            <p>{HELP.comunidad.avisos}</p>
            <p className="mt-2">{HELP.comunidad.encuestas}</p>
            <p className="mt-2">{HELP.comunidad.personal}</p>
          </>
        }
      />
      <CommunityManager
        posts={posts}
        documents={documents}
        condominiums={session.condominiums.map((condo) => ({ id: condo.id, name: condo.name }))}
        initialCondominiumId={condominiumId}
        clusters={clusters}
        teamMembers={team.members}
        teamInvitations={team.invitations}
        currentUserId={session.userId}
      />
    </div>
  );
}
