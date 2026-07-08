export interface ClusterRef {
  id: string;
  name: string;
}

export function formatClusterScopeLabel(clusters: ClusterRef[]): string {
  if (clusters.length === 0) return 'Todo el fraccionamiento';
  if (clusters.length === 1) return clusters[0].name;
  return clusters.map((cluster) => cluster.name).join(' · ');
}

export function parseClusterIdsFromFormData(formData: FormData, field = 'cluster_ids'): string[] {
  return [...new Set(formData.getAll(field).map((value) => String(value).trim()).filter(Boolean))];
}
