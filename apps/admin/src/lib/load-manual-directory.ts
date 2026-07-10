import type { CommitteeKind } from '@veka/shared';

import { getLoaderCondominiumId } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

export interface ManualDirectoryEntry {
  id: string;
  entryKind: 'staff' | 'committee';
  staffSectionId: 'administrative' | 'maintenance' | 'security' | null;
  committeeTitle: string | null;
  roleLabel: string | null;
  fullName: string;
  phone: string | null;
  unitIdentifier: string | null;
  clusterId: string | null;
  clusterName: string | null;
  showPhone: boolean;
}

export async function loadManualDirectoryEntries(
  condominiumId?: string,
  entryKind?: 'staff' | 'committee',
): Promise<ManualDirectoryEntry[]> {
  const condoId = condominiumId ?? (await getLoaderCondominiumId());
  const supabase = await createClient();

  let query = supabase
    .from('directory_manual_entries')
    .select(
      'id, entry_kind, staff_section_id, committee_title, role_label, full_name, phone, unit_identifier, cluster_id, show_phone, cluster:clusters(name)',
    )
    .eq('condominium_id', condoId)
    .order('created_at', { ascending: true });

  if (entryKind) {
    query = query.eq('entry_kind', entryKind);
  }

  const { data } = await query;

  return (data ?? []).map((row) => {
    const clusterRaw = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
    const showPhone = Boolean(row.show_phone);

    return {
      id: row.id,
      entryKind: row.entry_kind as 'staff' | 'committee',
      staffSectionId: (row.staff_section_id as ManualDirectoryEntry['staffSectionId']) ?? null,
      committeeTitle: row.committee_title?.trim() || null,
      roleLabel: row.role_label?.trim() || null,
      fullName: row.full_name.trim(),
      phone: showPhone ? row.phone?.trim() || null : null,
      unitIdentifier: row.unit_identifier?.trim() || null,
      clusterId: row.cluster_id ?? null,
      clusterName: clusterRaw?.name ?? null,
      showPhone,
    };
  });
}

export type ManualCommitteeKind = CommitteeKind;
