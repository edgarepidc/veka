import type { FeeCampaignStatus, FeeScope, FundType } from './constants';

export const FEE_SCOPE_LABELS: Record<FeeScope, string> = {
  general: 'Mantenimiento general',
  cluster: 'Por torre / cluster',
  extraordinary: 'Extraordinaria',
};

export const FEE_CAMPAIGN_STATUS_LABELS: Record<FeeCampaignStatus, string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
};

export function feeScopeLabel(scope: FeeScope): string {
  return FEE_SCOPE_LABELS[scope];
}

export function feeCampaignStatusLabel(status: FeeCampaignStatus): string {
  return FEE_CAMPAIGN_STATUS_LABELS[status];
}

export function defaultFeeConcept(scope: FeeScope, clusterName?: string): string {
  const month = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  if (scope === 'extraordinary') return 'Cuota extraordinaria';
  if (scope === 'cluster' && clusterName) return `Cuota de mantenimiento — ${clusterName} — ${month}`;
  return `Cuota de mantenimiento — ${month}`;
}
