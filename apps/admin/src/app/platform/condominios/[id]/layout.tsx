import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlatformCondoNav } from '@/components/PlatformCondoNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadPlatformCondominiumSummary } from '@/lib/load-platform-data';

import { PlatformCondominiumStatusPanel } from './PlatformCondominiumStatusPanel';
import { PlatformImpersonateButton } from './PlatformImpersonateButton';

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
        <Link href="/platform/condominios" className="font-medium text-violet-700 hover:underline">
          ← Condominios
        </Link>
      </p>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title={condo.name}
          highlight="tenant"
          subtitle={condo.organization?.name ?? 'Sin organización'}
        />
        <PlatformImpersonateButton condominiumId={condo.id} />
      </div>

      <PlatformCondominiumStatusPanel condominiumId={condo.id} status={condo.status} />
      <PlatformCondoNav condominiumId={condo.id} />
      {children}
    </div>
  );
}
