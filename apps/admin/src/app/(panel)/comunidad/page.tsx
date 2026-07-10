import { CommunityManager } from '@/app/(panel)/comunidad/CommunityManager';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
import { requireAdminSession } from '@/lib/require-admin';
import { loadAssemblies, loadAssemblyTicketOptions } from '@/lib/load-assemblies';
import { loadCommunityDocuments, loadCommunityPosts } from '@/lib/load-community';
import { loadCommunityDirectory } from '@/lib/load-community-directory';
import { loadCondominiumClusters } from '@/lib/community-clusters';
import { loadCommitteeMembers, loadResidentDirectory } from '@/lib/load-committee';

export default async function ComunidadPage() {
  const session = await requireAdminSession();
  const condominiumId = session.activeCondominiumId;
  if (!condominiumId) return null;

  const [
    posts,
    documents,
    clusters,
    directoryMembers,
    residents,
    vigilanceMembers,
    assemblies,
    assemblyTickets,
  ] = await Promise.all([
    loadCommunityPosts(condominiumId),
    loadCommunityDocuments(condominiumId),
    loadCondominiumClusters(condominiumId),
    loadCommunityDirectory(condominiumId),
    loadResidentDirectory(condominiumId),
    loadCommitteeMembers(condominiumId, 'vigilance'),
    loadAssemblies(condominiumId),
    loadAssemblyTicketOptions(condominiumId),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Comunidad"
        highlight="del condominio"
        subtitle="Avisos, encuestas, documentos, mi comunidad y asambleas por torre."
        help={
          <>
            <p>{HELP.comunidad.avisos}</p>
            <p className="mt-2">{HELP.comunidad.encuestas}</p>
            <p className="mt-2">{HELP.comunidad.miComunidad}</p>
            <p className="mt-2">{HELP.comunidad.asambleas}</p>
          </>
        }
      />
      <CommunityManager
        posts={posts}
        documents={documents}
        condominiums={session.condominiums.map((condo) => ({ id: condo.id, name: condo.name }))}
        initialCondominiumId={condominiumId}
        clusters={clusters}
        directoryMembers={directoryMembers}
        residents={residents}
        vigilanceMembers={vigilanceMembers}
        assemblies={assemblies}
        assemblyTickets={assemblyTickets}
      />
    </div>
  );
}
