import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';

export default function EspaciosPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Espacios" highlight="comunes" />
      <GlassCard>
        <p className="text-muted">Módulo en construcción — amenidades y reservas.</p>
      </GlassCard>
    </div>
  );
}
