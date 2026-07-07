'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { usePanelSession } from '@/components/SessionProvider';

const ADMIN_NAV = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/finanzas', label: 'Finanzas', icon: '💳' },
  { href: '/comunidad', label: 'Comunidad', icon: '💬' },
  { href: '/espacios', label: 'Espacios', icon: '🏊' },
  { href: '/seguridad', label: 'Seguridad', icon: '🔒' },
  { href: '/mantenimiento', label: 'Mantenimiento', icon: '🔧' },
  { href: '/configuracion/perfil', label: 'Configuración', icon: '⚙️' },
];

const RESIDENT_NAV = [
  { href: '/mi-cuenta', label: 'Mi cuenta', icon: '💳' },
  { href: '/configuracion/perfil', label: 'Mi perfil', icon: '👤' },
];

function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/mi-cuenta') return pathname === '/mi-cuenta';
  if (href.startsWith('/configuracion')) return pathname.startsWith('/configuracion');
  return pathname === href || pathname.startsWith(`${href}/`);
}

const GUARD_NAV = [
  { href: '/seguridad', label: 'Caseta', icon: '🔒' },
  { href: '/configuracion/perfil', label: 'Mi perfil', icon: '👤' },
];

export function AdminNav() {
  const pathname = usePathname();
  const session = usePanelSession();
  const nav = session.isAdmin
    ? ADMIN_NAV
    : session.canAccessSecurity
      ? GUARD_NAV
      : RESIDENT_NAV;

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {nav.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'glass-sidebar-link-active'
                : 'text-muted hover:bg-white/10 hover:text-[var(--text)]'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
