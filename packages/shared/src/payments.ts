import { roundMoney } from './finance-analytics';

export type ChargeSettlementStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'forgiven';

export interface ChargeForSettlement {
  id: string;
  amount: number;
  amount_paid?: number;
  due_date: string;
  status: ChargeSettlementStatus | string;
  charge_kind: string;
  parent_charge_id: string | null;
}

export function chargeAmountPaid(charge: { amount_paid?: number }): number {
  return roundMoney(Number(charge.amount_paid ?? 0));
}

export function chargeBalanceDue(charge: {
  amount: number;
  amount_paid?: number;
  status: string;
}): number {
  if (charge.status === 'paid' || charge.status === 'cancelled' || charge.status === 'forgiven') {
    return 0;
  }
  return roundMoney(Math.max(0, Number(charge.amount) - chargeAmountPaid(charge)));
}

export function isUnsettledCharge(charge: {
  status: string;
  amount: number;
  amount_paid?: number;
}): boolean {
  return chargeBalanceDue(charge) > 0.001;
}

export function unpaidLateFeesForPrincipal(
  principalId: string,
  charges: ChargeForSettlement[],
): ChargeForSettlement[] {
  return charges.filter(
    (charge) =>
      charge.charge_kind === 'late_fee' &&
      charge.parent_charge_id === principalId &&
      isUnsettledCharge(charge),
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

export function groupBalanceDue(chargeIds: string[], charges: ChargeForSettlement[]): number {
  return roundMoney(
    charges
      .filter((charge) => chargeIds.includes(charge.id))
      .reduce((sum, charge) => sum + chargeBalanceDue(charge), 0),
  );
}

export interface PaymentAllocation {
  chargeId: string;
  amount: number;
}

export function validatePartialPaymentAmount(
  paymentAmount: number,
  orderedChargeIds: string[],
  charges: ChargeForSettlement[],
): void {
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error('El monto debe ser mayor a cero.');
  }
  const maxOwed = groupBalanceDue(orderedChargeIds, charges);
  if (maxOwed <= 0) {
    throw new Error('No hay saldo pendiente en este grupo de cargos.');
  }
  if (paymentAmount > maxOwed + 0.01) {
    throw new Error(`El monto no puede exceder el saldo pendiente (${maxOwed.toFixed(2)}).`);
  }
}

export function allocatePaymentToCharges(
  paymentAmount: number,
  orderedChargeIds: string[],
  charges: ChargeForSettlement[],
): PaymentAllocation[] {
  validatePartialPaymentAmount(paymentAmount, orderedChargeIds, charges);

  let remaining = roundMoney(paymentAmount);
  const allocations: PaymentAllocation[] = [];

  for (const chargeId of orderedChargeIds) {
    const charge = charges.find((row) => row.id === chargeId);
    if (!charge) continue;

    const owed = chargeBalanceDue(charge);
    if (owed <= 0) continue;

    const applied = roundMoney(Math.min(remaining, owed));
    if (applied > 0) {
      allocations.push({ chargeId, amount: applied });
      remaining = roundMoney(remaining - applied);
    }

    if (remaining <= 0.001) break;
  }

  if (remaining > 0.01) {
    throw new Error('No se pudo aplicar el monto a los cargos pendientes.');
  }

  return allocations;
}

export interface PaymentGroup {
  primaryCharge: ChargeForSettlement;
  relatedCharges: ChargeForSettlement[];
  chargeIds: string[];
  totalAmount: number;
}

export function buildNextPaymentGroup(charges: ChargeForSettlement[]): PaymentGroup | null {
  const unpaid = charges
    .filter((charge) => isUnsettledCharge(charge))
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id));

  const primary = unpaid[0];
  if (!primary) return null;

  const chargeIds = chargeIdsSettledByPayment(primary.id, charges);
  const idSet = new Set(chargeIds);
  const relatedCharges = charges.filter((charge) => idSet.has(charge.id) && charge.id !== primary.id);
  const totalAmount = groupBalanceDue(chargeIds, charges);

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

export function unitTotalBalanceDue(charges: ChargeForSettlement[]): number {
  return roundMoney(
    charges
      .filter((charge) => isUnsettledCharge(charge))
      .reduce((sum, charge) => sum + chargeBalanceDue(charge), 0),
  );
}
