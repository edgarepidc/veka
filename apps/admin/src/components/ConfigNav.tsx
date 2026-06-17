'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/configuracion/perfil', label: 'Mi perfil' },
  { href: '/configuracion/condominio', label: 'Condominio' },
  { href: '/configuracion/unidades', label: 'Unidades' },
  { href: '/configuracion/equipo', label: 'Equipo' },
];

export function ConfigNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-tab-strip mb-6">
      {TABS.map((tab) => {
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
