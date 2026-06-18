export type ChargeSettlementStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface ChargeForSettlement {
  id: string;
  amount: number;
  due_date: string;
  status: ChargeSettlementStatus;
  charge_kind: string;
  parent_charge_id: string | null;
}

export function isUnsettledCharge(status: string): boolean {
  return status === 'pending' || status === 'overdue';
}

export function unpaidLateFeesForPrincipal(
  principalId: string,
  charges: ChargeForSettlement[],
): ChargeForSettlement[] {
  return charges.filter(
    (charge) =>
      charge.charge_kind === 'late_fee' &&
      charge.parent_charge_id === principalId &&
      isUnsettledCharge(charge.status),
  );
}

export function chargeIdsSettledByPayment(
  primaryChargeId: string,
  charges: ChargeForSettlement[],
): string[] {
  const primary = charges.find((charge) => charge.id === primaryChargeId);
  if (!primary) return [primaryChargeId];

  const ids = [primaryChargeId];
  if (primary.charge_kind === 'principal') {
    for (const lateFee of unpaidLateFeesForPrincipal(primaryChargeId, charges)) {
      ids.push(lateFee.id);
    }
  }
  return ids;
}

export interface PaymentGroup {
  primaryCharge: ChargeForSettlement;
  relatedCharges: ChargeForSettlement[];
  chargeIds: string[];
  totalAmount: number;
}

export function buildNextPaymentGroup(charges: ChargeForSettlement[]): PaymentGroup | null {
  const unpaid = charges
    .filter((charge) => isUnsettledCharge(charge.status))
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id));

  const primary = unpaid[0];
  if (!primary) return null;

  const chargeIds = chargeIdsSettledByPayment(primary.id, charges);
  const idSet = new Set(chargeIds);
  const relatedCharges = charges.filter((charge) => idSet.has(charge.id) && charge.id !== primary.id);
  const totalAmount = charges
    .filter((charge) => idSet.has(charge.id))
    .reduce((sum, charge) => sum + Number(charge.amount), 0);

  return { primaryCharge: primary, relatedCharges, chargeIds, totalAmount };
}

export function matchesFeeClusterFilter(
  scope: 'general' | 'cluster' | 'extraordinary',
  clusterId: string | null | undefined,
  filterClusterId: string,
): boolean {
  if (!filterClusterId) return true;
  if (scope === 'general') return true;
  return clusterId === filterClusterId;
}
