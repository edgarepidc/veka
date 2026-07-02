import { FinanceDashboard } from '@/components/FinanceDashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
import { requireAdminSession } from '@/lib/require-admin';

export default async function FinanzasPage() {
  const session = await requireAdminSession();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Finanzas"
        highlight="del condominio"
        subtitle="Estado financiero, cuotas, ingresos, egresos, proveedores, nómina y morosidad por torre."
        help={
          <>
            <p>Usa las pestañas para navegar el ciclo completo: presupuesto → cuotas → cobranza → movimientos → morosidad.</p>
            <p className="mt-2">Filtra por condominio y torre arriba a la derecha; muchos reportes respetan ese alcance.</p>
          </>
        }
      />
      <FinanceDashboard initialCondominiumId={session.activeCondominiumId} />
    </div>
  );
}
