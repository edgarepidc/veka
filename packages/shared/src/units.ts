export const UNIT_KINDS = ['casa', 'depto'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export const UNIT_RELATIONSHIPS = ['owner', 'tenant'] as const;
export type UnitRelationship = (typeof UNIT_RELATIONSHIPS)[number];

export const UNIT_KIND_LABELS: Record<UnitKind, string> = {
  casa: 'Casa',
  depto: 'Depto',
};

/** Perfil de ocupación dentro de la unidad (ambos son rol resident en el condominio). */
export const UNIT_RELATIONSHIP_LABELS: Record<UnitRelationship, string> = {
  owner: 'Residente propietario',
  tenant: 'Residente inquilino',
};

export const UNIT_RELATIONSHIP_CHIP_LABELS: Record<UnitRelationship, string> = {
  owner: 'Propietarios',
  tenant: 'Inquilinos',
};

export function formatUnitLabel(
  clusterName: string,
  unit: { identifier: string; unit_kind?: UnitKind | null; unit_number?: string | null },
): string {
  if (unit.unit_kind && unit.unit_number) {
    return `${clusterName} / ${UNIT_KIND_LABELS[unit.unit_kind]} / ${unit.unit_number}`;
  }
  return unit.identifier;
}

export function buildUnitIdentifier(
  clusterName: string,
  kind: UnitKind,
  number: string,
): string {
  return `${clusterName} / ${UNIT_KIND_LABELS[kind]} / ${number.trim()}`;
}

/** Propietarios e inquilinos comparten permisos operativos; solo difieren en votaciones formales. */
export function canVoteInFormalPoll(unitRelationship: UnitRelationship | null | undefined): boolean {
  return unitRelationship !== 'tenant';
}

export const POLL_DEBT_MESSAGE =
  'Tu unidad tiene adeudos pendientes. Regulariza tu cuenta en Finanzas para votar en esta encuesta.';

export function canVoteInPoll(
  unitRelationship: UnitRelationship | null | undefined,
  isFormal: boolean,
  options?: { requirePaymentCurrent?: boolean; hasOutstandingDebt?: boolean },
): boolean {
  if (isFormal && !canVoteInFormalPoll(unitRelationship)) return false;
  if (options?.requirePaymentCurrent && options?.hasOutstandingDebt) return false;
  return true;
}

export function formatResidentProfileLabel(
  unitRelationship: UnitRelationship | null | undefined,
): string | null {
  if (unitRelationship === 'owner') return UNIT_RELATIONSHIP_LABELS.owner;
  if (unitRelationship === 'tenant') return UNIT_RELATIONSHIP_LABELS.tenant;
  return null;
}
