import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';

export default function SeguridadPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Seguridad" highlight="y acceso" />
      <GlassCard>
        <p className="text-muted">Módulo en construcción — visitas, QR y paquetería.</p>
      </GlassCard>
    </div>
  );
}
