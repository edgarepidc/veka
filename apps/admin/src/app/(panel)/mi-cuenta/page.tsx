import { redirect } from 'next/navigation';

import { ResidentAccountPanel } from '@/components/ResidentAccountPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ActivePaymentPlan, ChargeSettlementStatus } from '@veka/shared';
import { loadAdminSession } from '@/lib/load-admin-session';
import { createClient } from '@/lib/supabase/server';

export default async function MiCuentaPage() {
  const session = await loadAdminSession();
  if (!session) redirect('/login');
  if (session.isAdmin) redirect('/');

  const unitId = session.membership?.unit_id;
  if (!unitId) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Mi cuenta" highlight="residente" />
        <p className="text-muted">
          Tu usuario no tiene una unidad asignada. Pide a la administración que te invite con tu correo.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [chargesRes, planRes] = await Promise.all([
    supabase
      .from('charges')
      .select('id, concept, amount, amount_paid, due_date, status, charge_kind, parent_charge_id')
      .eq('unit_id', unitId)
      .order('due_date', { ascending: true }),
    supabase
      .from('payment_plans')
      .select(
        'id, title, status, total_amount, installments:payment_plan_installments(id, installment_number, due_date, amount, amount_paid, status), charge_links:payment_plan_charges(charge_id)',
      )
      .eq('unit_id', unitId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  const charges = chargesRes.data;
  const planRow = planRes.data;
  const activePlan: ActivePaymentPlan | null = planRow
    ? {
        id: planRow.id,
        title: planRow.title,
        status: planRow.status,
        total_amount: Number(planRow.total_amount),
        installments: (planRow.installments ?? []).map((row) => ({
          id: row.id,
          installment_number: row.installment_number,
          due_date: row.due_date,
          amount: Number(row.amount),
          amount_paid: Number(row.amount_paid ?? 0),
          status: row.status,
        })),
        linked_charge_ids: (planRow.charge_links ?? []).map((link) => link.charge_id),
      }
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Mi cuenta"
        highlight="financiera"
        subtitle="Consulta tus cargos y paga en línea con tarjeta (modo prueba Stripe)."
      />
      <ResidentAccountPanel
        unitLabel={session.membership?.unit_identifier ?? '—'}
        condominiumName={session.membership?.condominium_name ?? 'Condominio'}
        activePlan={activePlan}
        charges={(charges ?? []).map((charge) => ({
          id: charge.id,
          concept: charge.concept,
          amount: Number(charge.amount),
          amount_paid: Number(charge.amount_paid ?? 0),
          due_date: charge.due_date,
          status: charge.status as ChargeSettlementStatus,
          charge_kind: charge.charge_kind,
          parent_charge_id: charge.parent_charge_id,
        }))}
      />
    </div>
  );
}
