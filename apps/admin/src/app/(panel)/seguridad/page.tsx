import { PackageRegisterPanel } from '@/components/PackageRegisterPanel';
import { VisitCheckInPanel } from '@/components/VisitCheckInPanel';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireAdminSession } from '@/lib/require-admin';
import { createClient } from '@/lib/supabase/server';

export default async function SeguridadPage() {
  const session = await requireAdminSession();
  const condominiumId = session.activeCondominiumId;

  if (!condominiumId) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Seguridad" highlight="y acceso" />
        <GlassCard>
          <p className="text-[var(--text-muted)]">Selecciona un condominio para registrar paquetes.</p>
        </GlassCard>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: units } = await supabase
    .from('units')
    .select('id, identifier')
    .eq('condominium_id', condominiumId)
    .order('identifier');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Seguridad"
        highlight="y acceso"
        subtitle="Paquetería en caseta y validación de visitas (QR en app móvil)."
      />

      <PackageRegisterPanel condominiumId={condominiumId} units={units ?? []} />

      <VisitCheckInPanel condominiumId={condominiumId} />

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Cómo funciona</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          El residente genera el pase en la app móvil y puede guardarlo como imagen. En caseta escanea el QR o
          ingresa la referencia; el sistema valida vigencia y registra el ingreso automáticamente.
        </p>
      </GlassCard>
    </div>
  );
}
