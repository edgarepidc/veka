export const UNIT_KINDS = ['casa', 'depto'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export const UNIT_RELATIONSHIPS = ['owner', 'tenant'] as const;
export type UnitRelationship = (typeof UNIT_RELATIONSHIPS)[number];

export const UNIT_KIND_LABELS: Record<UnitKind, string> = {
  casa: 'Casa',
  depto: 'Depto',
};

export const UNIT_RELATIONSHIP_LABELS: Record<UnitRelationship, string> = {
  owner: 'Propietario',
  tenant: 'Inquilino',
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
