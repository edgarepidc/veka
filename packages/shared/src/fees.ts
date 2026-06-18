import type { FeeCampaignStatus, FeeScope } from './constants';

export const FEE_SCOPE_LABELS: Record<FeeScope, string> = {
  general: 'Mantenimiento general',
  cluster: 'Por torre / cluster',
  extraordinary: 'Extraordinaria',
};

export const FEE_CAMPAIGN_STATUS_LABELS: Record<FeeCampaignStatus, string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
};

export interface FeeCampaignRef {
  scope: FeeScope;
  concept: string;
  amount?: number;
  cluster?: { name: string } | null;
}

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

export function feeCampaignBadge(scope: FeeScope, clusterName?: string | null): string {
  if (scope === 'cluster' && clusterName) return `${feeScopeLabel(scope)} · ${clusterName}`;
  return feeScopeLabel(scope);
}

export function chargeDisplayTitle(charge: {
  concept: string;
  fee_campaign?: FeeCampaignRef | null;
}): string {
  return charge.fee_campaign?.concept ?? charge.concept;
}

export function chargeDisplaySubtitle(charge: {
  concept: string;
  fee_campaign?: FeeCampaignRef | null;
}): string | null {
  if (!charge.fee_campaign) return null;
  return feeCampaignBadge(charge.fee_campaign.scope, charge.fee_campaign.cluster?.name ?? null);
}
