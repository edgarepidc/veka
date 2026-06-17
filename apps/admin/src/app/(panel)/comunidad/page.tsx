import { CommunityManager } from '@/app/(panel)/comunidad/CommunityManager';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadCommunityPosts } from '@/lib/load-community';

export default async function ComunidadPage() {
  const posts = await loadCommunityPosts();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Comunidad"
        highlight="y avisos"
        subtitle="Publica avisos y encuestas formales o informales para residentes."
      />
      <CommunityManager posts={posts} />
    </div>
  );
}
