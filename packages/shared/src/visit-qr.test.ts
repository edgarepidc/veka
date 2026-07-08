import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  encodeVisitQrPayload,
  parseVisitQrPayload,
  visitTypeLabelEs,
  VISIT_QR_TYPE,
} from './visit-qr';

describe('visit QR helpers', () => {
  const token = 'a1b2c3d4e5f6789012345678abcdef01';

  it('encodes and parses JSON payload', () => {
    const raw = encodeVisitQrPayload(token);
    const parsed = parseVisitQrPayload(raw);
    assert.ok(parsed);
    assert.equal(parsed.type, VISIT_QR_TYPE);
    assert.equal(parsed.token, token);
  });

  it('parses plain hex token', () => {
    const parsed = parseVisitQrPayload(token);
    assert.ok(parsed);
    assert.equal(parsed.token, token);
  });

  it('rejects invalid content', () => {
    assert.equal(parseVisitQrPayload(''), null);
    assert.equal(parseVisitQrPayload('not-a-token'), null);
    assert.equal(parseVisitQrPayload('{"type":"other"}'), null);
  });

  it('labels visit types in Spanish', () => {
    assert.equal(visitTypeLabelEs('visit'), 'Visita');
    assert.equal(visitTypeLabelEs('service'), 'Servicio');
    assert.equal(visitTypeLabelEs('rental'), 'Renta');
  });
});
