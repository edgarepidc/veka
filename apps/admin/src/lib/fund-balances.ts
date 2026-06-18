import type { SupabaseClient } from '@supabase/supabase-js';

export async function reconcileCondominiumFundBalances(
  supabase: SupabaseClient,
  condominiumId: string,
): Promise<void> {
  const { error } = await supabase.rpc('reconcile_condominium_fund_balances', {
    p_condominium_id: condominiumId,
  });
  if (error) throw new Error(error.message);
}

export async function reconcileAllFundBalances(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('reconcile_all_fund_balances');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
