import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildScopeFilterItems, type ClusterRef } from '@veka/shared';

import type { ActiveMembership } from '@/hooks/useMembership';
import { supabase } from '@/lib/supabase';

export function useCondominiumClusters(primary: ActiveMembership | null) {
  const [clusters, setClusters] = useState<ClusterRef[]>([]);
  const [loading, setLoading] = useState(true);

  const condominiumName = primary?.condominium?.name ?? 'Condominio';

  const refresh = useCallback(async () => {
    if (!primary?.condominium_id) {
      setClusters([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('clusters')
      .select('id, name')
      .eq('condominium_id', primary.condominium_id)
      .order('name');

    setClusters((data as ClusterRef[]) ?? []);
    setLoading(false);
  }, [primary?.condominium_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scopeFilterItems = useMemo(
    () => buildScopeFilterItems({ condominiumName, clusters }),
    [condominiumName, clusters],
  );

  const hasClusters = clusters.length > 0;

  return {
    clusters,
    condominiumName,
    scopeFilterItems,
    hasClusters,
    loading,
    refresh,
  };
}
