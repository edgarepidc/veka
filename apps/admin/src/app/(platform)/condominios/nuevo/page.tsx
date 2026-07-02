import Link from 'next/link';

import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';

import { PlatformCreateCondominiumForm } from './PlatformCreateCondominiumForm';

export default function PlatformNuevoCondominioPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Nuevo"
        highlight="condominio"
        subtitle="Alta comercial: crea el tenant y asigna al administrador del cliente."
      />
      <p className="mb-4 text-sm text-muted">
        <Link href="/platform/condominios" className="text-violet-300 hover:underline">
          ← Volver a condominios
        </Link>
      </p>
      <GlassCard>
        <PlatformCreateCondominiumForm />
      </GlassCard>
    </div>
  );
}
