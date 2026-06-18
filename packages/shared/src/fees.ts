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

export interface FeeSourceRef {
  scope: FeeScope;
  concept: string;
  amount?: number;
  cluster?: { name: string } | null;
}

/** @deprecated use FeeSourceRef */
export type FeeCampaignRef = FeeSourceRef;

export function feeScopeLabel(scope: FeeScope): string {
  return FEE_SCOPE_LABELS[scope];
}

export function feeCampaignStatusLabel(status: FeeCampaignStatus): string {
  return FEE_CAMPAIGN_STATUS_LABELS[status];
}

export function defaultFeeConcept(scope: FeeScope, clusterName?: string): string {
  const month = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  if (scope === 'extraordinary') return 'Cuota extraordinaria';
  if (scope === 'cluster' && clusterName) return `Cuota de mantenimiento — ${clusterName}`;
  return 'Cuota de mantenimiento';
}

export function feeCampaignBadge(scope: FeeScope, clusterName?: string | null): string {
  if (scope === 'cluster' && clusterName) return `${feeScopeLabel(scope)} · ${clusterName}`;
  return feeScopeLabel(scope);
}

export function chargeFeeSource(charge: {
  fee_campaign?: FeeSourceRef | null;
  recurring_fee?: FeeSourceRef | null;
}): FeeSourceRef | null {
  return charge.recurring_fee ?? charge.fee_campaign ?? null;
}

export function chargeDisplayTitle(charge: {
  concept: string;
  charge_kind?: string;
  fee_campaign?: FeeSourceRef | null;
  recurring_fee?: FeeSourceRef | null;
}): string {
  if (charge.charge_kind === 'late_fee') return charge.concept;
  const source = chargeFeeSource(charge);
  return source?.concept ?? charge.concept;
}

export function chargeDisplaySubtitle(charge: {
  concept: string;
  fee_campaign?: FeeSourceRef | null;
  recurring_fee?: FeeSourceRef | null;
}): string | null {
  const source = chargeFeeSource(charge);
  if (!source) return null;
  return feeCampaignBadge(source.scope, source.cluster?.name ?? null);
}
