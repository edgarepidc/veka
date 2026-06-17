import { MaintenanceManager } from '@/app/(panel)/mantenimiento/MaintenanceManager';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadMaintenanceData } from '@/lib/load-maintenance';

export default async function MantenimientoPage() {
  const data = await loadMaintenanceData();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Mantenimiento"
        highlight="y tickets"
        subtitle="Reportes de residentes, calendarios de áreas comunes y evidencia de trabajos."
      />
      <MaintenanceManager {...data} />
    </div>
  );
}
