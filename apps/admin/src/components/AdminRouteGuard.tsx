'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { canAccessPanelPath, panelHomePath } from '@/lib/route-access';

import { usePanelSession } from './SessionProvider';

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const session = usePanelSession();
  const pathname = usePathname();
  const router = useRouter();

  const access = { isAdmin: session.isAdmin, canAccessSecurity: session.canAccessSecurity };

  useEffect(() => {
    if (canAccessPanelPath(pathname, access)) return;
    router.replace(panelHomePath(access));
  }, [access, pathname, router]);

  if (!canAccessPanelPath(pathname, access)) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-sm text-muted">
        Redirigiendo…
      </div>
    );
  }

  return children;
}
