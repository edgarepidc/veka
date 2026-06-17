import { ConfigNav } from '@/components/ConfigNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadAdminSession } from '@/lib/load-admin-session';

import { ProfileForm } from './ProfileForm';

export default async function AdminProfilePage() {
  const session = await loadAdminSession();
  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Configuración" highlight="administrativa" subtitle="Tu perfil y preferencias de acceso." />
      <ConfigNav />
      <ProfileForm session={session} />
    </div>
  );
}
