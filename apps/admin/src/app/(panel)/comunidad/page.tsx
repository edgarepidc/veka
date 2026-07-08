import { CommunityManager } from '@/app/(panel)/comunidad/CommunityManager';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { loadCommunityDocuments, loadCommunityPosts } from '@/lib/load-community';

export default async function ComunidadPage() {
  const [posts, documents, condominiumId] = await Promise.all([
    loadCommunityPosts(),
    loadCommunityDocuments(),
    getLoaderCondominiumId(),
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
      <CommunityManager posts={posts} documents={documents} condominiumId={condominiumId} />
    </div>
  );
}
