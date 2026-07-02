import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlatformCondoNav } from '@/components/PlatformCondoNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadPlatformCondominiumSummary } from '@/lib/load-platform-data';

export default async function PlatformCondominioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const condo = await loadPlatformCondominiumSummary(id);
  if (!condo) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-4 text-sm text-muted">
        <Link href="/platform/condominios" className="text-violet-300 hover:underline">
          ← Condominios
        </Link>
      </p>

      <PageHeader
        title={condo.name}
        highlight="tenant"
        subtitle={condo.organization?.name ?? 'Sin organización'}
      />

      <PlatformCondoNav condominiumId={condo.id} />
      {children}
    </div>
  );
}
