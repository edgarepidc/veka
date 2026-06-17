import { FinanceDashboard } from '@/components/FinanceDashboard';
import { PageHeader } from '@/components/ui/PageHeader';

export default function FinanzasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Finanzas" highlight="del condominio" subtitle="Cuotas, pagos y egresos." />
      <FinanceDashboard />
    </div>
  );
}
