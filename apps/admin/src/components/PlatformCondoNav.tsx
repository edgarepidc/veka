'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function PlatformCondoNav({ condominiumId }: { condominiumId: string }) {
  const pathname = usePathname();
  const base = `/platform/condominios/${condominiumId}`;

  const tabs = [
    { href: base, label: 'Configuración', exact: true },
    { href: `${base}/unidades`, label: 'Unidades' },
    { href: `${base}/invitaciones`, label: 'Invitaciones' },
    { href: `${base}/equipo`, label: 'Equipo' },
  ];

  return (
    <nav className="glass-tab-strip mb-6">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={`glass-tab ${active ? 'glass-tab-active' : ''}`}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
