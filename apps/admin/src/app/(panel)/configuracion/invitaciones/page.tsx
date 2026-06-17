import { ConfigNav } from '@/components/ConfigNav';
import { PageHeader } from '@/components/ui/PageHeader';

import { InvitationsPanel } from './InvitationsPanel';

export default function InvitacionesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Invitaciones"
        highlight="de residentes"
        subtitle="Da de alta vecinos para que accedan a la app móvil."
      />
      <ConfigNav />
      <InvitationsPanel />
    </div>
  );
}
