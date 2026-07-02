import { createClient } from '@/lib/supabase/server';

export interface HomeStats {
  operatingBalance: number;
  reserveBalance: number;
  unitsOnTimePercent: number | null;
}

export async function loadHomeStats(condominiumId: string): Promise<HomeStats> {
  const supabase = await createClient();

  const [fundsRes, unitsRes, chargesRes] = await Promise.all([
    supabase.from('fund_balances').select('fund_type, balance').eq('condominium_id', condominiumId),
    supabase.from('units').select('id').eq('condominium_id', condominiumId),
    supabase
      .from('charges')
      .select('unit_id, status, amount, paid_amount')
      .eq('condominium_id', condominiumId)
      .not('status', 'in', '("paid","cancelled")'),
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

  return { operatingBalance: operating, reserveBalance: reserve, unitsOnTimePercent };
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
