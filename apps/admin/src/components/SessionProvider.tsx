'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { AdminSession } from '@/lib/load-admin-session';

const SessionContext = createContext<AdminSession | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: AdminSession;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function usePanelSession(): AdminSession {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('usePanelSession must be used within SessionProvider');
  }
  return session;
}
