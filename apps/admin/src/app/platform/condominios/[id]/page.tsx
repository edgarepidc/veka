import { notFound } from 'next/navigation';

import { CondominiumForm } from '@/app/(panel)/configuracion/condominio/CondominiumForm';
import { loadPlatformCondominiumForConfig } from '@/lib/load-platform-data';

import { savePlatformCondominiumConfig } from './config-actions';

export default async function PlatformCondominioConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const condo = await loadPlatformCondominiumForConfig(id);
  if (!condo) notFound();

  const updateAction = savePlatformCondominiumConfig.bind(null, id);

  return <CondominiumForm condo={condo} updateAction={updateAction} />;
}
