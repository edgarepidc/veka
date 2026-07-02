export type CondominiumStatus = 'active' | 'suspended' | 'archived';

export type TenantHealthLabel = 'activo' | 'onboarding' | 'sin_admin';

export const CONDOMINIUM_STATUS_LABELS: Record<CondominiumStatus, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  archived: 'Archivado',
};

export const TENANT_HEALTH_LABELS: Record<TenantHealthLabel, string> = {
  activo: 'Operando',
  onboarding: 'Onboarding',
  sin_admin: 'Sin admin',
};

export function deriveTenantHealth(input: {
  status: CondominiumStatus;
  hasStaffAdmin: boolean;
  unitCount: number;
}): TenantHealthLabel | null {
  if (input.status !== 'active') return null;
  if (!input.hasStaffAdmin) return 'sin_admin';
  if (input.unitCount === 0) return 'onboarding';
  return 'activo';
}

export function statusBadgeClass(status: CondominiumStatus): string {
  switch (status) {
    case 'active':
      return 'glass-tag-green';
    case 'suspended':
      return 'glass-tag-amber';
    case 'archived':
      return 'glass-tag-red';
    default:
      return 'glass-tag-blue';
  }
}

export function healthBadgeClass(health: TenantHealthLabel): string {
  switch (health) {
    case 'activo':
      return 'glass-tag-green';
    case 'onboarding':
      return 'glass-tag-blue';
    case 'sin_admin':
      return 'glass-tag-amber';
    default:
      return 'glass-tag-blue';
  }
}
