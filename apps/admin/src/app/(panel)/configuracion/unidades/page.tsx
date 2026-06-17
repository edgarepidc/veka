import { ConfigNav } from '@/components/ConfigNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadClustersAndUnits } from '@/lib/load-condominium';

import { UnitsManager } from './UnitsManager';

export default async function UnidadesConfigPage() {
  const { clusters, units } = await loadClustersAndUnits();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Unidades"
        highlight="y clusters"
        subtitle="Torres, villas y casas. Invita propietarios e inquilinos desde cada unidad."
      />
      <ConfigNav />
      <UnitsManager clusters={clusters} units={units} />
    </div>
  );
}
