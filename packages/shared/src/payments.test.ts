import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allocatePaymentToCharges,
  buildNextPaymentGroup,
  chargeBalanceDue,
  chargeIdsSettledByPayment,
  groupBalanceDue,
  isUnsettledCharge,
  unitTotalBalanceDue,
  validatePartialPaymentAmount,
} from './payments';

const charges = [
  {
    id: 'c1',
    amount: 1000,
    amount_paid: 0,
    due_date: '2026-01-01',
    status: 'pending',
    charge_kind: 'principal',
    parent_charge_id: null,
  },
  {
    id: 'c2',
    amount: 150,
    amount_paid: 0,
    due_date: '2026-01-15',
    status: 'pending',
    charge_kind: 'late_fee',
    parent_charge_id: 'c1',
  },
  {
    id: 'c3',
    amount: 500,
    amount_paid: 500,
    due_date: '2026-02-01',
    status: 'paid',
    charge_kind: 'principal',
    parent_charge_id: null,
  },
] as const;

describe('payments settlement', () => {
  it('computes charge balance due', () => {
    assert.equal(chargeBalanceDue(charges[0]), 1000);
    assert.equal(chargeBalanceDue(charges[2]), 0);
  });

  it('detects unsettled charges', () => {
    assert.equal(isUnsettledCharge(charges[0]), true);
    assert.equal(isUnsettledCharge(charges[2]), false);
  });

  it('includes late fees when settling principal', () => {
    assert.deepEqual(chargeIdsSettledByPayment('c1', [...charges]), ['c1', 'c2']);
    assert.deepEqual(chargeIdsSettledByPayment('c3', [...charges]), ['c3']);
  });

  it('allocates partial payments oldest-first', () => {
    const allocations = allocatePaymentToCharges(200, ['c1', 'c2'], [...charges]);
    assert.deepEqual(allocations, [{ chargeId: 'c1', amount: 200 }]);
  });

  it('allocates across principal and late fee', () => {
    const allocations = allocatePaymentToCharges(1100, ['c1', 'c2'], [...charges]);
    assert.deepEqual(allocations, [
      { chargeId: 'c1', amount: 1000 },
      { chargeId: 'c2', amount: 100 },
    ]);
  });

  it('rejects overpayment', () => {
    assert.throws(
      () => validatePartialPaymentAmount(2000, ['c1', 'c2'], [...charges]),
      /no puede exceder/,
    );
  });

  it('builds next payment group with late fees', () => {
    const group = buildNextPaymentGroup([...charges]);
    assert.ok(group);
    assert.equal(group.primaryCharge.id, 'c1');
    assert.equal(group.totalAmount, 1150);
    assert.deepEqual(group.chargeIds, ['c1', 'c2']);
  });

  it('sums unit total balance', () => {
    assert.equal(groupBalanceDue(['c1', 'c2'], [...charges]), 1150);
    assert.equal(unitTotalBalanceDue([...charges]), 1150);
  });
});
