import { SpacesManager } from '@/app/(panel)/espacios/SpacesManager';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireAdminSession } from '@/lib/require-admin';
import { loadEspaciosData } from '@/lib/load-espacios';

export default async function EspaciosPage() {
  await requireAdminSession();
  const data = await loadEspaciosData();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Espacios"
        highlight="comunes"
        subtitle="Amenidades, horarios y reservas de áreas comunes."
      />
      <SpacesManager {...data} />
    </div>
  );
}
