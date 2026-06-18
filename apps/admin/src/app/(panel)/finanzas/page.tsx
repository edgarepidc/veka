import { FinanceDashboard } from '@/components/FinanceDashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireAdminSession } from '@/lib/require-admin';

export default async function FinanzasPage() {
  await requireAdminSession();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Finanzas"
        highlight="del condominio"
        subtitle="Estado financiero, cuotas, ingresos, egresos, proveedores, nómina y morosidad por torre."
      />
      <FinanceDashboard />
    </div>
  );
}
