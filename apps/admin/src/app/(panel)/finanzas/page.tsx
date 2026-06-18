import { FinanceDashboard } from '@/components/FinanceDashboard';
import { PageHeader } from '@/components/ui/PageHeader';

export default function FinanzasPage() {
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
