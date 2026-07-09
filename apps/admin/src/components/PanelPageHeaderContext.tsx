'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type PanelPageHeaderState = {
  title: string;
  highlight?: string;
  subtitle?: string;
  help?: ReactNode;
};

type PanelPageHeaderContextValue = {
  header: PanelPageHeaderState | null;
  setHeader: (header: PanelPageHeaderState | null) => void;
};

const PanelPageHeaderContext = createContext<PanelPageHeaderContextValue | null>(null);

export { PanelPageHeaderContext };

export function PanelPageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PanelPageHeaderState | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PanelPageHeaderContext.Provider value={value}>{children}</PanelPageHeaderContext.Provider>;
}

export function usePanelPageHeader() {
  const ctx = useContext(PanelPageHeaderContext);
  return ctx ?? { header: null, setHeader: () => {} };
}
