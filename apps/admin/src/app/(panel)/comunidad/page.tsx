import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ComunidadPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Comunidad" highlight="y avisos" />
      <GlassCard>
        <p className="text-muted">Módulo en construcción — avisos, encuestas y documentos.</p>
      </GlassCard>
    </div>
  );
}
