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
        Registra cuentas nuevas o otorga acceso a usuarios existentes. También puedes usar{' '}
        <code className="font-medium text-violet-700">PLATFORM_ADMIN_EMAILS</code> como respaldo de
        acceso.
      </p>
    </div>
  );
}
