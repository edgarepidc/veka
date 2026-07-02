import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadPlatformAdmins } from '@/lib/load-platform-data';
import { loadPlatformSession } from '@/lib/platform-admin';

import { PlatformAdminsManager } from './PlatformAdminsManager';

export default async function PlatformAdminsPage() {
  const session = await loadPlatformSession();
  const admins = await loadPlatformAdmins();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Equipo"
        highlight="Veka Platform"
        subtitle="Dueños de la app con acceso al panel de super administración."
      />

      <GlassCard>
        <PlatformAdminsManager admins={admins} currentUserId={session?.userId ?? ''} />
      </GlassCard>

      <p className="mt-4 text-xs text-subtle">
        El correo debe pertenecer a un usuario ya registrado en Veka. También puedes usar la variable{' '}
        <code className="text-violet-300">PLATFORM_ADMIN_EMAILS</code> como respaldo de acceso.
      </p>
    </div>
  );
}
