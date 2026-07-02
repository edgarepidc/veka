'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { usePanelSession } from '@/components/SessionProvider';

const ADMIN_TABS = [
  { href: '/configuracion/perfil', label: 'Mi perfil' },
  { href: '/configuracion/unidades', label: 'Unidades' },
  { href: '/configuracion/invitaciones', label: 'Invitaciones' },
  { href: '/configuracion/equipo', label: 'Equipo' },
];

const RESIDENT_TABS = [{ href: '/configuracion/perfil', label: 'Mi perfil' }];

export function ConfigNav() {
  const pathname = usePathname();
  const session = usePanelSession();
  const tabs = session.isAdmin ? ADMIN_TABS : RESIDENT_TABS;

  return (
    <nav className="glass-tab-strip mb-6">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`glass-tab ${active ? 'glass-tab-active' : ''}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
