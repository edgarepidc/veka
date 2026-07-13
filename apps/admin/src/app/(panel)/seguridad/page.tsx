import { SecurityManager } from '@/app/(panel)/seguridad/SecurityManager';
import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadSeguridadData } from '@/lib/load-seguridad';
import { parseCondominiumSettings } from '@/lib/condominium-settings';
import { HELP } from '@/lib/help-content';
import { requireSecuritySession } from '@/lib/require-security';
import { createClient } from '@/lib/supabase/server';
import { parseSecuritySettings } from '@veka/shared';

export default async function SeguridadPage() {
  const session = await requireSecuritySession();
  const condominiumId = session.activeCondominiumId;

  if (!condominiumId) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Seguridad" highlight="y acceso" />
        <GlassCard>
          <p className="text-muted">Selecciona un condominio para operar caseta.</p>
        </GlassCard>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: condo }, ops] = await Promise.all([
    supabase.from('condominiums').select('settings').eq('id', condominiumId).maybeSingle(),
    loadSeguridadData(condominiumId),
  ]);

  const securitySettings = parseSecuritySettings(parseCondominiumSettings(condo?.settings).security);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Seguridad"
        highlight="y acceso"
        subtitle="Paquetería, visitas del día y validación de pases QR."
        help={<p>{HELP.seguridad}</p>}
      />
      <SecurityManager
        condominiumId={condominiumId}
        visits={ops.visits}
        packages={ops.packages}
        units={ops.units}
        clusters={ops.clusters}
        securitySettings={securitySettings}
        canEditSettings={session.isAdmin}
      />
    </div>
  );
}
