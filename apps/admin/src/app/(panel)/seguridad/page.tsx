import { PackageRegisterPanel } from '@/components/PackageRegisterPanel';
import { SecurityOpsPanels } from '@/components/SecurityOpsPanels';
import { SecuritySettingsPanel } from '@/components/SecuritySettingsPanel';
import { VisitCheckInPanel } from '@/components/VisitCheckInPanel';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadSeguridadData } from '@/lib/load-seguridad';
import { parseCondominiumSettings } from '@/lib/condominium-settings';
import { requireSecuritySession } from '@/lib/require-security';
import { createClient } from '@/lib/supabase/server';
import { parseSecuritySettings } from '@veka/shared';

export default async function SeguridadPage() {
  const session = await requireSecuritySession();
  const condominiumId = session.activeCondominiumId;

  if (!condominiumId) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Seguridad" highlight="y acceso" />
        <GlassCard>
          <p className="text-[var(--text-muted)]">Selecciona un condominio para operar caseta.</p>
        </GlassCard>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: units }, { data: condo }, ops] = await Promise.all([
    supabase
      .from('units')
      .select('id, identifier')
      .eq('condominium_id', condominiumId)
      .order('identifier'),
    supabase.from('condominiums').select('settings').eq('id', condominiumId).maybeSingle(),
    loadSeguridadData(condominiumId),
  ]);

  const securitySettings = parseSecuritySettings(parseCondominiumSettings(condo?.settings).security);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Seguridad"
        highlight="y acceso"
        subtitle="Paquetería, visitas del día y validación de pases QR."
      />

      <SecuritySettingsPanel
        condominiumId={condominiumId}
        settings={securitySettings}
        canEdit={session.isAdmin}
      />

      <VisitCheckInPanel condominiumId={condominiumId} />

      <PackageRegisterPanel condominiumId={condominiumId} units={units ?? []} />

      <SecurityOpsPanels visits={ops.visits} packages={ops.packages} />

      <GlassCard>
        <h2 className="text-lg font-semibold text-[var(--text)]">Cómo funciona</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          El residente genera el pase en la app móvil. En caseta escanea el QR o ingresa la referencia; el
          sistema valida vigencia y registra el ingreso. Los guardias pueden usar este panel desde el navegador
          del celular o una tablet en recepción.
        </p>
      </GlassCard>
    </div>
  );
}
