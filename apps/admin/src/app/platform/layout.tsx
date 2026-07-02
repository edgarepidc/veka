import { requirePlatformAdmin } from '@/lib/require-platform-admin';

import { PlatformShell } from '@/components/PlatformShell';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePlatformAdmin();

  return <PlatformShell session={session}>{children}</PlatformShell>;
}
