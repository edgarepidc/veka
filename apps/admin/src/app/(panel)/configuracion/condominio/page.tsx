import { ConfigNav } from '@/components/ConfigNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadCondominium } from '@/lib/load-condominium';

import { CondominiumForm } from './CondominiumForm';

export default async function CondominioConfigPage() {
  const condo = await loadCondominium();

  if (!condo) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Configuración" highlight="del condominio" />
        <ConfigNav />
        <p className="text-muted">No se encontró el condominio.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Configuración"
        highlight="del condominio"
        subtitle="Nombre, dirección y zona horaria del residencial."
      />
      <ConfigNav />
      <CondominiumForm condo={condo} />
    </div>
  );
}
