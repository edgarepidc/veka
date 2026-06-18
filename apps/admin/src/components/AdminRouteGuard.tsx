'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { isAdminOnlyPath, residentHomePath } from '@/lib/route-access';

import { usePanelSession } from './SessionProvider';

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const session = usePanelSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (session.isAdmin) return;
    if (isAdminOnlyPath(pathname)) {
      router.replace(residentHomePath());
    }
  }, [pathname, router, session.isAdmin]);

  if (!session.isAdmin && isAdminOnlyPath(pathname)) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-sm text-muted">
        Redirigiendo a tu cuenta de residente…
      </div>
    );
  }

  return children;
}
