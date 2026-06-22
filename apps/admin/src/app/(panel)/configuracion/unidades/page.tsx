import { ConfigNav } from '@/components/ConfigNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
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
        help={<p>{HELP.unidades}</p>}
      />
      <ConfigNav />
      <UnitsManager clusters={clusters} units={units} />
    </div>
  );
}
