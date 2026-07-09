import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildVariableFeeCaptureCsv,
  parseVariableFeeCaptureCsv,
} from './recurring-fees';

const units = [
  { id: 'u1', identifier: 'A-101' },
  { id: 'u2', identifier: 'A-102' },
  { id: 'u3', identifier: 'B-201' },
];

describe('variable fee CSV capture', () => {
  it('builds a template with unit rows', () => {
    const csv = buildVariableFeeCaptureCsv(units, { u1: '420.5' });
    assert.match(csv, /^unidad,monto,notas\n/);
    assert.match(csv, /A-101,420\.5,/);
    assert.match(csv, /A-102,,/);
  });

  it('parses amounts by unit identifier', () => {
    const csv = `unidad,monto,notas
A-101,420.50,
A-102,"1,250.00",
B-201,,
Z-999,10,
`;
    const result = parseVariableFeeCaptureCsv(csv, units);
    assert.equal(result.matched, 2);
    assert.equal(result.amountsByUnitId.u1, '420.5');
    assert.equal(result.amountsByUnitId.u2, '1250');
    assert.equal(result.skippedEmpty, 1);
    assert.deepEqual(result.unknownUnits, ['Z-999']);
  });
});
