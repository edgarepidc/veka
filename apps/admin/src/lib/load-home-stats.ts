import {
  delinquencyAgingBars,
  formatCurrency,
  type ChartBar,
} from '@veka/shared';

import { condominiumDayBoundsIso } from '@/lib/condo-day-bounds';
import { createClient } from '@/lib/supabase/server';

export interface HomeReservationPreview {
  id: string;
  starts_at: string;
  amenity_name: string;
  unit_identifier: string;
  status: string;
}

export interface HomeStats {
  operatingBalance: number;
  reserveBalance: number;
  unitsOnTimePercent: number | null;
  totalUnits: number;
  overdueUnitCount: number;
  overdueBalance: number;
  openTicketCount: number;
  visitsTodayCount: number;
  packagesWaitingCount: number;
  monthIncome: number;
  monthExpense: number;
  agingBars: ChartBar[];
  reservationsThisWeek: number;
  activeAmenities: number;
  upcomingReservations: HomeReservationPreview[];
}

function monthBoundsIso(timeZone: string, reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const start = `${year}-${month}-01`;
  const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
  const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
  const endMonth = String(nextMonth).padStart(2, '0');
  const exclusiveEnd = `${nextYear}-${endMonth}-01`;
  return { start, exclusiveEnd };
}

function weekAheadIso(reference = new Date()) {
  const end = new Date(reference);
  end.setDate(end.getDate() + 7);
  return end.toISOString();
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
  const { start: monthStart, exclusiveEnd: monthEnd } = monthBoundsIso(timezone);
  const nowIso = new Date().toISOString();
  const weekEndIso = weekAheadIso();

  const [
    fundsRes,
    unitsRes,
    chargesRes,
    ticketsRes,
    visitsRes,
    packagesRes,
    paymentsRes,
    expensesRes,
    incomeRes,
    amenitiesRes,
    weekReservationsRes,
    upcomingRes,
  ] = await Promise.all([
    supabase.from('fund_balances').select('fund_type, balance').eq('condominium_id', condominiumId),
    supabase.from('units').select('id').eq('condominium_id', condominiumId),
    supabase
      .from('charges')
      .select('unit_id, status, amount, amount_paid, due_date')
      .eq('condominium_id', condominiumId)
      .not('status', 'in', '("paid","cancelled","forgiven")'),
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
    supabase
      .from('payments')
      .select('amount, status, paid_at, created_at')
      .eq('condominium_id', condominiumId)
      .eq('status', 'approved')
      .gte('paid_at', monthStart)
      .lt('paid_at', monthEnd),
    supabase
      .from('expenses')
      .select('amount, status, expense_date')
      .eq('condominium_id', condominiumId)
      .eq('status', 'paid')
      .gte('expense_date', monthStart)
      .lt('expense_date', monthEnd),
    supabase
      .from('income_entries')
      .select('amount, income_date')
      .eq('condominium_id', condominiumId)
      .gte('income_date', monthStart)
      .lt('income_date', monthEnd),
    supabase
      .from('amenities')
      .select('id', { count: 'exact', head: true })
      .eq('condominium_id', condominiumId)
      .eq('is_active', true),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('condominium_id', condominiumId)
      .in('status', ['confirmed', 'pending'])
      .gte('starts_at', nowIso)
      .lte('starts_at', weekEndIso),
    supabase
      .from('reservations')
      .select(
        'id, starts_at, status, amenity:amenities(name), unit:units(identifier)',
      )
      .eq('condominium_id', condominiumId)
      .in('status', ['confirmed', 'pending'])
      .gte('ends_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(5),
  ]);

  const operating =
    Number(fundsRes.data?.find((row) => row.fund_type === 'operating')?.balance ?? 0) || 0;
  const reserve =
    Number(fundsRes.data?.find((row) => row.fund_type === 'reserve')?.balance ?? 0) || 0;

  const unitIds = new Set((unitsRes.data ?? []).map((row) => row.id));
  const overdueUnits = new Set<string>();
  let overdueBalance = 0;

  const chargeRows = (chargesRes.data ?? []).map((row) => ({
    unit_id: row.unit_id as string | null,
    status: String(row.status),
    amount: Number(row.amount),
    amount_paid: Number(row.amount_paid ?? 0),
    due_date: String(row.due_date),
  }));

  for (const charge of chargeRows) {
    const due = charge.amount - charge.amount_paid;
    if (due <= 0.01) continue;
    overdueBalance += due;
    if (charge.unit_id) overdueUnits.add(charge.unit_id);
  }

  const totalUnits = unitIds.size;
  const unitsOnTimePercent =
    totalUnits > 0 ? Math.round(((totalUnits - overdueUnits.size) / totalUnits) * 100) : null;

  const monthIncome =
    (paymentsRes.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0) +
    (incomeRes.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const monthExpense = (expensesRes.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  const agingBars = delinquencyAgingBars(chargeRows);

  const upcomingReservations: HomeReservationPreview[] = (upcomingRes.data ?? []).map((row) => {
    const amenity = Array.isArray(row.amenity) ? row.amenity[0] : row.amenity;
    const unit = Array.isArray(row.unit) ? row.unit[0] : row.unit;
    return {
      id: String(row.id),
      starts_at: String(row.starts_at),
      status: String(row.status),
      amenity_name: amenity?.name ?? 'Espacio',
      unit_identifier: unit?.identifier ?? '—',
    };
  });

  return {
    operatingBalance: operating,
    reserveBalance: reserve,
    unitsOnTimePercent,
    totalUnits,
    overdueUnitCount: overdueUnits.size,
    overdueBalance,
    openTicketCount: ticketsRes.count ?? 0,
    visitsTodayCount: visitsRes.count ?? 0,
    packagesWaitingCount: packagesRes.count ?? 0,
    monthIncome,
    monthExpense,
    agingBars,
    reservationsThisWeek: weekReservationsRes.count ?? 0,
    activeAmenities: amenitiesRes.count ?? 0,
    upcomingReservations,
  };
}

export function formatHomeStatMoney(value: number): string {
  return formatCurrency(value);
}
