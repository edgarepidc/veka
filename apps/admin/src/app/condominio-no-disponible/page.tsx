import { redirect } from 'next/navigation';

import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { CONDOMINIUM_STATUS_LABELS } from '@/lib/condominium-status';
import type { CondominiumStatus } from '@/lib/condominium-status';
import { readActiveCondominiumCookie } from '@/lib/condominium-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export default async function CondominioNoDisponiblePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let status: CondominiumStatus = 'suspended';
  const condoId = await readActiveCondominiumCookie();
  if (condoId) {
    const admin = createAdminClient();
    const { data } = await admin.from('condominiums').select('status').eq('id', condoId).maybeSingle();
    if (data?.status) status = data.status as CondominiumStatus;
  }

  const message =
    status === 'archived'
      ? 'Este condominio fue archivado y ya no está disponible en el panel.'
      : 'Este condominio está suspendido temporalmente. Contacta al administrador de Veka.';

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
      <div className="w-full">
        <PageHeader title="Condominio" highlight="no disponible" />
        <GlassCard>
          <p className="text-sm text-muted">{message}</p>
          <p className="mt-3 text-xs text-subtle">Estado: {CONDOMINIUM_STATUS_LABELS[status]}</p>
        </GlassCard>
      </div>
    </div>
  );
}
