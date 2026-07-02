import type { SupabaseClient } from '@supabase/supabase-js';

import { reconcileAllFundBalances, reconcileCondominiumFundBalances } from '@/lib/fund-balances';
import { ensureLateFeesForCondo } from '@/lib/late-fees';
import { deliverChargeReminder } from '@/lib/notifications';
import { ensureRecurringChargesForCondo } from '@/lib/recurring-fees';
import { createAdminClient } from '@/lib/supabase/admin';

/** Minimum days between automatic reminders for the same charge. */
const REMINDER_COOLDOWN_DAYS = 7;

type ReminderRuleKey = 'charge_due_soon' | 'charge_overdue' | 'charge_overdue_reminder';

export interface DailyFinanceMaintenanceResult {
  condominiums: number;
  recurringChargesGenerated: number;
  lateFeesCreated: number;
  dueSoonReminders: number;
  overdueNotices: number;
  remindersProcessed: number;
  reminderDeliveries: number;
  fundBalancesReconciled: number;
  installmentsMarkedOverdue: number;
}

function daysPastDue(dueDate: string, reference = new Date()): number {
  const due = new Date(dueDate.includes('T') ? dueDate : `${dueDate}T12:00:00`);
  const ref = new Date(reference);
  ref.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((ref.getTime() - due.getTime()) / 86_400_000));
}

function daysUntilDue(dueDate: string, reference = new Date()): number {
  const due = new Date(dueDate.includes('T') ? dueDate : `${dueDate}T12:00:00`);
  const ref = new Date(reference);
  ref.setHours(12, 0, 0, 0);
  return Math.floor((due.getTime() - ref.getTime()) / 86_400_000);
}

async function wasRecentlyReminded(
  admin: SupabaseClient,
  chargeId: string,
): Promise<boolean> {
  const cooldownCutoff = new Date();
  cooldownCutoff.setDate(cooldownCutoff.getDate() - REMINDER_COOLDOWN_DAYS);

  const { data } = await admin
    .from('payment_reminder_log')
    .select('id')
    .eq('charge_id', chargeId)
    .gte('sent_at', cooldownCutoff.toISOString())
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

async function processReminderRule(
  admin: SupabaseClient,
  condominiumId: string,
  ruleKey: ReminderRuleKey,
): Promise<{ processed: number; deliveries: number }> {
  const { data: rule } = await admin
    .from('notification_rules')
    .select('days_before, days_after, is_enabled, notify_push, notify_email')
    .eq('condominium_id', condominiumId)
    .eq('rule_key', ruleKey)
    .maybeSingle();

  if (!rule?.is_enabled) {
    return { processed: 0, deliveries: 0 };
  }

  const statuses = ruleKey === 'charge_due_soon' ? (['pending'] as const) : (['pending', 'overdue'] as const);

  const { data: charges } = await admin
    .from('charges')
    .select('id, unit_id, concept, amount, due_date, status')
    .eq('condominium_id', condominiumId)
    .in('status', [...statuses]);

  let processed = 0;
  let deliveries = 0;

  for (const charge of charges ?? []) {
    let shouldSend = false;
    let logMessage = '';
    let kind: 'due_soon' | 'overdue' | 'overdue_reminder' = 'overdue_reminder';

    if (ruleKey === 'charge_due_soon') {
      if (!rule.days_before) continue;
      const daysUntil = daysUntilDue(charge.due_date);
      if (daysUntil < 0 || daysUntil > Number(rule.days_before)) continue;
      shouldSend = true;
      kind = 'due_soon';
      logMessage = `Recordatorio pre-vencimiento (${daysUntil} día(s) restante(s)).`;
    } else if (ruleKey === 'charge_overdue') {
      if (!rule.days_after) continue;
      const days = daysPastDue(charge.due_date);
      if (days !== Number(rule.days_after)) continue;
      shouldSend = true;
      kind = 'overdue';
      logMessage = `Aviso de mora (día ${days}).`;
    } else {
      if (!rule.days_after) continue;
      const days = daysPastDue(charge.due_date);
      if (days < Number(rule.days_after)) continue;
      shouldSend = true;
      kind = 'overdue_reminder';
      logMessage = `Recordatorio automático (${days} días de mora).`;
    }

    if (!shouldSend) continue;
    if (await wasRecentlyReminded(admin, charge.id)) continue;

    const result = await deliverChargeReminder({
      condominiumId,
      unitId: charge.unit_id,
      chargeId: charge.id,
      concept: charge.concept,
      amount: Number(charge.amount),
      dueDate: charge.due_date,
      notifyPush: Boolean(rule.notify_push),
      notifyEmail: Boolean(rule.notify_email),
      source: 'cron',
      kind,
    });

    processed += 1;
    deliveries += result.pushSent + result.emailSent;

    await admin.from('payment_reminder_log').insert({
      condominium_id: condominiumId,
      unit_id: charge.unit_id,
      charge_id: charge.id,
      channel: result.pushSent > 0 ? 'push' : result.emailSent > 0 ? 'email' : 'manual',
      message: logMessage,
      sent_by: null,
    });
  }

  return { processed, deliveries };
}

export async function runDailyFinanceMaintenance(): Promise<DailyFinanceMaintenanceResult> {
  const admin = createAdminClient();

  await admin.rpc('refresh_charge_statuses');
  const { data: installmentRefresh } = await admin.rpc('refresh_payment_plan_installment_statuses');
  const installmentsMarkedOverdue = Number(installmentRefresh ?? 0);

  const { data: condominiums } = await admin
    .from('condominiums')
    .select('id')
    .eq('status', 'active');
  const condoIds = (condominiums ?? []).map((row) => row.id as string);

  let recurringChargesGenerated = 0;
  let lateFeesCreated = 0;
  let dueSoonReminders = 0;
  let overdueNotices = 0;
  let remindersProcessed = 0;
  let reminderDeliveries = 0;

  for (const condoId of condoIds) {
    try {
      recurringChargesGenerated += await ensureRecurringChargesForCondo(admin, condoId, null);
    } catch {
      // Skip condos that fail charge generation; cron continues for others.
    }
    lateFeesCreated += await ensureLateFeesForCondo(admin, condoId, null);

    const dueSoonResult = await processReminderRule(admin, condoId, 'charge_due_soon');
    dueSoonReminders += dueSoonResult.processed;
    reminderDeliveries += dueSoonResult.deliveries;

    const overdueResult = await processReminderRule(admin, condoId, 'charge_overdue');
    overdueNotices += overdueResult.processed;
    reminderDeliveries += overdueResult.deliveries;

    const reminderResult = await processReminderRule(admin, condoId, 'charge_overdue_reminder');
    remindersProcessed += reminderResult.processed;
    reminderDeliveries += reminderResult.deliveries;
  }

  const fundBalancesReconciled = await reconcileAllFundBalances(admin);

  return {
    condominiums: condoIds.length,
    recurringChargesGenerated,
    lateFeesCreated,
    dueSoonReminders,
    overdueNotices,
    remindersProcessed,
    reminderDeliveries,
    fundBalancesReconciled,
    installmentsMarkedOverdue,
  };
}

export async function reconcileFundsAfterMovement(
  supabase: SupabaseClient,
  condominiumId: string,
): Promise<void> {
  await reconcileCondominiumFundBalances(supabase, condominiumId);
}
