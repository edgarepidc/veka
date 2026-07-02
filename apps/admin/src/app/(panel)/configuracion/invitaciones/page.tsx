import { PageHeader } from '@/components/ui/PageHeader';
import { HELP } from '@/lib/help-content';
import { requireAdminSession } from '@/lib/require-admin';

import { InvitationsPanel } from './InvitationsPanel';

export default async function InvitacionesPage() {
  const session = await requireAdminSession();

  if (!session.activeCondominiumId) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Invitaciones" highlight="residentes" subtitle="Sin condominio activo." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Invitaciones"
        highlight="residentes"
        subtitle="Invita propietarios, inquilinos y personal. Se envía un correo con instrucciones para activar el acceso."
        help={<p>{HELP.unidades}</p>}
      />
      <InvitationsPanel
        condominiumId={session.activeCondominiumId}
        condominiumName={session.membership?.condominium_name ?? 'Condominio'}
      />
    </div>
  );
}
