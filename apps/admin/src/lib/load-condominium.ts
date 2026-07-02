import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { parseCondominiumSettings, type CondominiumSettings } from '@/lib/condominium-settings';
import { createClient } from '@/lib/supabase/server';
import type { UnitKind, UnitRelationship } from '@veka/shared';

export interface CondominiumData {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
  settings: CondominiumSettings;
}

export interface ClusterRow {
  id: string;
  name: string;
}

export interface UnitOccupant {
  name: string;
  email?: string;
  pending?: boolean;
}

export interface UnitRow {
  id: string;
  identifier: string;
  coefficient: number;
  cluster_id: string | null;
  cluster: { name: string } | null;
  unit_kind: UnitKind | null;
  unit_number: string | null;
  owner: UnitOccupant | null;
  tenant: UnitOccupant | null;
  resident: UnitOccupant | null;
}

export async function loadCondominium(condominiumId?: string): Promise<CondominiumData | null> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();
  const { data } = await supabase
    .from('condominiums')
    .select('id, name, slug, address, timezone, settings')
    .eq('id', condoId)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    settings: parseCondominiumSettings(data.settings),
  } as CondominiumData;
}

function mapOccupant(
  name: string | null | undefined,
  email?: string,
  pending?: boolean,
): UnitOccupant | null {
  if (!name && !email) return null;
  return {
    name: name ?? email ?? 'Sin nombre',
    email,
    pending,
  };
}

function attachOccupancy(
  units: Omit<UnitRow, 'owner' | 'tenant' | 'resident'>[],
  memberships: {
    unit_id: string | null;
    unit_relationship: UnitRelationship | null;
    profile: { full_name: string | null } | { full_name: string | null }[] | null;
  }[],
  invitations: {
    unit_id: string | null;
    email: string;
    unit_relationship: UnitRelationship | null;
  }[],
): UnitRow[] {
  const byUnit = new Map<
    string,
    { owner: UnitOccupant | null; tenant: UnitOccupant | null; resident: UnitOccupant | null }
  >();

  for (const unit of units) {
    byUnit.set(unit.id, { owner: null, tenant: null, resident: null });
  }

  for (const row of memberships) {
    if (!row.unit_id) continue;
    const slot = byUnit.get(row.unit_id);
    if (!slot) continue;

    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const occupant = mapOccupant(profile?.full_name ?? null);

    if (row.unit_relationship === 'owner') {
      slot.owner = occupant;
    } else if (row.unit_relationship === 'tenant') {
      slot.tenant = occupant;
    } else if (!slot.resident && !slot.owner) {
      slot.resident = occupant;
    }
  }

  for (const invite of invitations) {
    if (!invite.unit_id) continue;
    const slot = byUnit.get(invite.unit_id);
    if (!slot) continue;

    const pending = mapOccupant(null, invite.email, true);

    if (invite.unit_relationship === 'tenant') {
      if (!slot.tenant) slot.tenant = pending;
    } else if (!slot.owner) {
      slot.owner = pending;
    }
  }

  return units.map((unit) => {
    const occupancy = byUnit.get(unit.id) ?? { owner: null, tenant: null, resident: null };
    return { ...unit, ...occupancy };
  });
}

export async function loadClustersAndUnits(condominiumId?: string): Promise<{
  clusters: ClusterRow[];
  units: UnitRow[];
}> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  const [clustersRes, unitsRes, membershipsRes, invitationsRes] = await Promise.all([
    supabase.from('clusters').select('id, name').eq('condominium_id', condoId).order('name'),
    supabase
      .from('units')
      .select('id, identifier, coefficient, cluster_id, unit_kind, unit_number, cluster:clusters(name)')
      .eq('condominium_id', condoId)
      .order('identifier'),
    supabase
      .from('memberships')
      .select('unit_id, unit_relationship, profile:profiles(full_name)')
      .eq('condominium_id', condoId)
      .eq('status', 'active')
      .not('unit_id', 'is', null),
    supabase
      .from('invitations')
      .select('unit_id, email, unit_relationship')
      .eq('condominium_id', condoId)
      .eq('status', 'pending')
      .not('unit_id', 'is', null),
  ]);

  const rawUnits = unitsRes.data ?? [];
  const baseUnits = rawUnits.map((row) => {
    const cluster = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
    return {
      id: row.id,
      identifier: row.identifier,
      coefficient: Number(row.coefficient),
      cluster_id: row.cluster_id,
      cluster: cluster ? { name: cluster.name } : null,
      unit_kind: (row.unit_kind as UnitKind | null) ?? null,
      unit_number: row.unit_number ?? null,
    };
  });

  const units = attachOccupancy(
    baseUnits,
    (membershipsRes.data ?? []) as Parameters<typeof attachOccupancy>[1],
    (invitationsRes.data ?? []) as Parameters<typeof attachOccupancy>[2],
  );

  return {
    clusters: (clustersRes.data as ClusterRow[]) ?? [],
    units,
  };
}
