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
    aportacion: 'Aportación a reserva',
  };
  return labels[category] ?? category;
}

export function reserveExpenseCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    obra_civil: 'Obra civil / fachada',
    cubierta: 'Cubierta / techos',
    elevadores: 'Elevadores / equipos',
    instalaciones: 'Instalaciones hidráulicas y eléctricas',
    pavimento: 'Pavimento / áreas comunes',
    amenidades: 'Amenidades mayores',
    contingencia: 'Contingencia',
  };
  return labels[category] ?? category;
}

export function reserveBudgetModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    percent: 'Porcentaje del operativo',
    components: 'Por componentes',
  };
  return labels[mode] ?? mode;
}

export function reserveIncomeBaseLabel(base: string): string {
  const labels: Record<string, string> = {
    total: 'Total ingresos operativos',
    fees: 'Solo cuotas ordinarias',
  };
  return labels[base] ?? base;
}
