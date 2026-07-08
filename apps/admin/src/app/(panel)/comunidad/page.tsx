import { CommunityManager } from '@/app/(panel)/comunidad/CommunityManager';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { loadCommunityDocuments, loadCommunityPosts } from '@/lib/load-community';
import { loadCondominiumClusters } from '@/lib/community-clusters';

export default async function ComunidadPage() {
  const condominiumId = await getLoaderCondominiumId();
  const [posts, documents, clusters] = await Promise.all([
    loadCommunityPosts(condominiumId),
    loadCommunityDocuments(condominiumId),
    loadCondominiumClusters(condominiumId),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Comunidad"
        highlight="y avisos"
        subtitle="Publica avisos y encuestas formales o informales para residentes."
        help={
          <>
            <p>{HELP.comunidad.avisos}</p>
            <p className="mt-2">{HELP.comunidad.encuestas}</p>
          </>
        }
      />
      <CommunityManager posts={posts} documents={documents} condominiumId={condominiumId} clusters={clusters} />
    </div>
  );
}
