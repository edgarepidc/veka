export interface ApprovalSettings {
  payments_dual_enabled: boolean;
  payments_dual_threshold: number;
}

export const DEFAULT_APPROVAL_SETTINGS: ApprovalSettings = {
  payments_dual_enabled: true,
  payments_dual_threshold: 5000,
};

export function parseApprovalSettings(raw: unknown): ApprovalSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_APPROVAL_SETTINGS };
  }
  const row = raw as Record<string, unknown>;
  return {
    payments_dual_enabled:
      typeof row.payments_dual_enabled === 'boolean'
        ? row.payments_dual_enabled
        : DEFAULT_APPROVAL_SETTINGS.payments_dual_enabled,
    payments_dual_threshold:
      Number(row.payments_dual_threshold) || DEFAULT_APPROVAL_SETTINGS.payments_dual_threshold,
  };
}

export function shouldRequireDualApproval(
  settings: ApprovalSettings,
  amount: number,
  paymentMethod: string | null,
): boolean {
  if (paymentMethod === 'gateway') return false;
  if (!settings.payments_dual_enabled) return false;
  return Number(amount) >= settings.payments_dual_threshold;
}
