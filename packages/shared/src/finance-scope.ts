export function matchesFinanceClusterFilter(
  itemClusterId: string | null | undefined,
  filterClusterId: string,
  options: { condoWideApplies?: boolean } = {},
): boolean {
  if (!filterClusterId) return true;
  if (options.condoWideApplies && itemClusterId == null) return true;
  return itemClusterId === filterClusterId;
}

export function incomeCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    cuotas: 'Cuotas',
    extraordinario: 'Extraordinario',
    servicios: 'Servicios',
    multas: 'Multas',
    otros: 'Otros',
  };
  return labels[category] ?? category;
}
