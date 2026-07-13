export interface ClusterRef {
  id: string;
  name: string;
}

export function formatClusterScopeLabel(
  clusters: ClusterRef[],
  condominiumName?: string | null,
): string {
  if (clusters.length === 0) {
    return condominiumName?.trim() || 'Condominio';
  }
  if (clusters.length === 1) return clusters[0].name;
  return clusters.map((cluster) => cluster.name).join(' · ');
}

export type CommunityClusterFilter = 'all' | 'general' | string;

/** Resident-facing scope filter: general = condo-wide only; cluster id = that scope + condo-wide. */
export function matchesCommunityClusterScope(
  clusters: ClusterRef[],
  filter: CommunityClusterFilter,
): boolean {
  if (filter === 'all' || filter === 'general') return filter === 'all' ? true : clusters.length === 0;
  if (clusters.length === 0) return true;
  return clusters.some((cluster) => cluster.id === filter);
}

/** Amenity / spaces: condo-wide items (no cluster) appear in every cluster view. */
export function matchesClusterResourceScope(
  resourceClusterId: string | null,
  filter: string,
): boolean {
  if (filter === 'all') return true;
  if (!resourceClusterId) return true;
  return resourceClusterId === filter;
}

export type ScopeFilterIconKind = 'business' | 'layers';

export interface ScopeFilterItem {
  key: string;
  label: string;
  icon: ScopeFilterIconKind;
}

/** Scope chips mirror admin: "Todo" + one chip per cluster. Empty when no clusters exist. */
export function buildScopeFilterItems(options: {
  condominiumName: string;
  clusters: ClusterRef[];
}): ScopeFilterItem[] {
  if (options.clusters.length === 0) return [];

  return [
    { key: 'all', label: 'Todo', icon: 'business' },
    ...options.clusters.map((cluster) => ({
      key: cluster.id,
      label: cluster.name,
      icon: 'layers' as const,
    })),
  ];
}

/** @deprecated Use buildScopeFilterItems */
export function communityClusterFilterItems(options: {
  clusterName: string | null;
  myClusterId: string | null;
  condominiumName?: string;
  clusters?: ClusterRef[];
}): ScopeFilterItem[] {
  if (options.clusters) {
    return buildScopeFilterItems({
      condominiumName: options.condominiumName ?? 'Condominio',
      clusters: options.clusters,
    });
  }
  const items: ScopeFilterItem[] = [
    { key: 'all', label: options.condominiumName ?? 'Condominio', icon: 'business' },
  ];
  if (options.myClusterId && options.clusterName) {
    items.push({
      key: options.myClusterId,
      label: options.clusterName,
      icon: 'layers',
    });
  }
  return items;
}

/** @deprecated Use buildScopeFilterItems */
export function spacesScopeFilterItems(options: {
  clusterName: string | null;
  hasCluster: boolean;
  condominiumName?: string;
  clusters?: ClusterRef[];
}): ScopeFilterItem[] {
  if (options.clusters) {
    return buildScopeFilterItems({
      condominiumName: options.condominiumName ?? 'Condominio',
      clusters: options.clusters,
    });
  }
  if (!options.hasCluster) return [];
  const items: ScopeFilterItem[] = [
    { key: 'all', label: options.condominiumName ?? 'Condominio', icon: 'business' },
  ];
  if (options.clusterName) {
    items.push({ key: 'cluster', label: options.clusterName, icon: 'layers' });
  }
  return items;
}

export function parseClusterIdsFromFormData(formData: FormData, field = 'cluster_ids'): string[] {
  return [...new Set(formData.getAll(field).map((value) => String(value).trim()).filter(Boolean))];
}
