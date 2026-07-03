export const VISIT_QR_TYPE = 'veka_visit' as const;
export const VISIT_QR_VERSION = 1;

export interface VisitQrPayload {
  v: number;
  type: typeof VISIT_QR_TYPE;
  token: string;
}

const TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

/** Encodes visit data for QR scanning at the guard booth. */
export function encodeVisitQrPayload(token: string): string {
  const payload: VisitQrPayload = {
    v: VISIT_QR_VERSION,
    type: VISIT_QR_TYPE,
    token,
  };
  return JSON.stringify(payload);
}

/** Parses QR content from the guard scanner or manual entry. */
export function parseVisitQrPayload(raw: string): VisitQrPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Partial<VisitQrPayload>;
    if (parsed.type === VISIT_QR_TYPE && typeof parsed.token === 'string' && parsed.token.length > 0) {
      return {
        v: parsed.v ?? VISIT_QR_VERSION,
        type: VISIT_QR_TYPE,
        token: parsed.token,
      };
    }
  } catch {
    // Fall through to plain token.
  }

  if (TOKEN_PATTERN.test(trimmed)) {
    return { v: VISIT_QR_VERSION, type: VISIT_QR_TYPE, token: trimmed };
  }

  return null;
}

export function visitTypeLabelEs(type: 'visit' | 'service' | 'rental'): string {
  if (type === 'service') return 'Servicio';
  if (type === 'rental') return 'Renta';
  return 'Visita';
}
