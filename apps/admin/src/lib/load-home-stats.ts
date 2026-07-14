import { condominiumDayBoundsIso } from '@/lib/condo-day-bounds';
import { createClient } from '@/lib/supabase/server';

export interface HomeStats {
  operatingBalance: number;
  reserveBalance: number;
  unitsOnTimePercent: number | null;
  overdueUnitCount: number;
  openTicketCount: number;
  visitsTodayCount: number;
  packagesWaitingCount: number;
}

export async function loadHomeStats(condominiumId: string): Promise<HomeStats> {
  const supabase = await createClient();

  const { data: condo } = await supabase
    .from('condominiums')
    .select('timezone')
    .eq('id', condominiumId)
    .maybeSingle();

  const timezone = condo?.timezone?.trim() || 'America/Mexico_City';
  const { startIso, endIso } = condominiumDayBoundsIso(timezone);

  const [fundsRes, unitsRes, chargesRes, ticketsRes, visitsRes, packagesRes] = await Promise.all([
    supabase.from('fund_balances').select('fund_type, balance').eq('condominium_id', condominiumId),
    supabase.from('units').select('id').eq('condominium_id', condominiumId),
    supabase
      .from('charges')
      .select('unit_id, status, amount, paid_amount')
      .eq('condominium_id', condominiumId)
      .not('status', 'in', '("paid","cancelled")'),
    supabase
      .from('maintenance_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('condominium_id', condominiumId)
      .in('status', ['open', 'in_progress']),
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('condominium_id', condominiumId)
      .lte('valid_from', endIso)
      .gte('valid_until', startIso),
    supabase
      .from('packages')
      .select('id', { count: 'exact', head: true })
      .eq('condominium_id', condominiumId)
      .eq('status', 'received'),
  ]);

  const operating =
    Number(fundsRes.data?.find((row) => row.fund_type === 'operating')?.balance ?? 0) || 0;
  const reserve =
    Number(fundsRes.data?.find((row) => row.fund_type === 'reserve')?.balance ?? 0) || 0;

  const unitIds = new Set((unitsRes.data ?? []).map((row) => row.id));
  const overdueUnits = new Set<string>();

  for (const charge of chargesRes.data ?? []) {
    if (!charge.unit_id) continue;
    const due = Number(charge.amount) - Number(charge.paid_amount ?? 0);
    if (due > 0.01) overdueUnits.add(charge.unit_id);
  }

  const totalUnits = unitIds.size;
  const unitsOnTimePercent =
    totalUnits > 0 ? Math.round(((totalUnits - overdueUnits.size) / totalUnits) * 100) : null;

  return {
    operatingBalance: operating,
    reserveBalance: reserve,
    unitsOnTimePercent,
    overdueUnitCount: overdueUnits.size,
    openTicketCount: ticketsRes.count ?? 0,
    visitsTodayCount: visitsRes.count ?? 0,
    packagesWaitingCount: packagesRes.count ?? 0,
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatHomeStatMoney(value: number): string {
  return formatMoney(value);
}
