import { DEMO_CONDO_ID } from '@/lib/constants';
import { parseCondominiumSettings, type CondominiumSettings } from '@/lib/condominium-settings';
import { createClient } from '@/lib/supabase/server';

export interface CondominiumData {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
  settings: CondominiumSettings;
}

export interface ClusterRow {
  id: string;
  name: string;
}

export interface UnitRow {
  id: string;
  identifier: string;
  coefficient: number;
  cluster_id: string | null;
  cluster: { name: string } | null;
}

export async function loadCondominium(): Promise<CondominiumData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('condominiums')
    .select('id, name, slug, address, timezone, settings')
    .eq('id', DEMO_CONDO_ID)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    settings: parseCondominiumSettings(data.settings),
  } as CondominiumData;
}

export async function loadClustersAndUnits(): Promise<{
  clusters: ClusterRow[];
  units: UnitRow[];
}> {
  const supabase = await createClient();

  const [clustersRes, unitsRes] = await Promise.all([
    supabase
      .from('clusters')
      .select('id, name')
      .eq('condominium_id', DEMO_CONDO_ID)
      .order('name'),
    supabase
      .from('units')
      .select('id, identifier, coefficient, cluster_id, cluster:clusters(name)')
      .eq('condominium_id', DEMO_CONDO_ID)
      .order('identifier'),
  ]);

  const rawUnits = unitsRes.data ?? [];
  const units: UnitRow[] = rawUnits.map((row) => {
    const cluster = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
    return {
      id: row.id,
      identifier: row.identifier,
      coefficient: Number(row.coefficient),
      cluster_id: row.cluster_id,
      cluster: cluster ? { name: cluster.name } : null,
    };
  });

  return {
    clusters: (clustersRes.data as ClusterRow[]) ?? [],
    units,
  };
}
