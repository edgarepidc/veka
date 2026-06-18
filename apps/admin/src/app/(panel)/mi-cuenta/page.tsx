import { redirect } from 'next/navigation';

import { ResidentAccountPanel } from '@/components/ResidentAccountPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ChargeSettlementStatus } from '@veka/shared';
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
  const { data: charges } = await supabase
    .from('charges')
    .select('id, concept, amount, due_date, status, charge_kind, parent_charge_id')
    .eq('unit_id', unitId)
    .order('due_date', { ascending: true });

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
        charges={(charges ?? []).map((charge) => ({
          id: charge.id,
          concept: charge.concept,
          amount: Number(charge.amount),
          due_date: charge.due_date,
          status: charge.status as ChargeSettlementStatus,
          charge_kind: charge.charge_kind,
          parent_charge_id: charge.parent_charge_id,
        }))}
      />
    </div>
  );
}
