'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  IoCalendarOutline,
  IoCalendar,
  IoCardOutline,
  IoCard,
  IoChatbubbleEllipsesOutline,
  IoChatbubbleEllipses,
  IoConstructOutline,
  IoConstruct,
  IoHomeOutline,
  IoHome,
  IoPersonOutline,
  IoPerson,
  IoSettingsOutline,
  IoSettings,
  IoShieldCheckmarkOutline,
  IoShieldCheckmark,
} from 'react-icons/io5';

import { usePanelSession } from '@/components/SessionProvider';

type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  iconActive: IconType;
};

const ADMIN_NAV: NavItem[] = [
  { href: '/', label: 'Inicio', icon: IoHomeOutline, iconActive: IoHome },
  { href: '/finanzas', label: 'Finanzas', icon: IoCardOutline, iconActive: IoCard },
  {
    href: '/comunidad',
    label: 'Comunidad',
    icon: IoChatbubbleEllipsesOutline,
    iconActive: IoChatbubbleEllipses,
  },
  { href: '/espacios', label: 'Espacios', icon: IoCalendarOutline, iconActive: IoCalendar },
  {
    href: '/seguridad',
    label: 'Seguridad',
    icon: IoShieldCheckmarkOutline,
    iconActive: IoShieldCheckmark,
  },
  {
    href: '/mantenimiento',
    label: 'Mantenimiento',
    icon: IoConstructOutline,
    iconActive: IoConstruct,
  },
  { href: '/configuracion', label: 'Configuración', icon: IoSettingsOutline, iconActive: IoSettings },
];

const RESIDENT_NAV: NavItem[] = [
  { href: '/mi-cuenta', label: 'Mi cuenta', icon: IoCardOutline, iconActive: IoCard },
  { href: '/configuracion?tab=perfil', label: 'Mi perfil', icon: IoPersonOutline, iconActive: IoPerson },
];

const GUARD_NAV: NavItem[] = [
  {
    href: '/seguridad',
    label: 'Caseta',
    icon: IoShieldCheckmarkOutline,
    iconActive: IoShieldCheckmark,
  },
  { href: '/configuracion?tab=perfil', label: 'Mi perfil', icon: IoPersonOutline, iconActive: IoPerson },
];

function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/mi-cuenta') return pathname === '/mi-cuenta';
  if (href.startsWith('/configuracion')) return pathname.startsWith('/configuracion');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ sectionLabel }: { sectionLabel?: string }) {
  const pathname = usePathname();
  const session = usePanelSession();
  const nav = session.isAdmin
    ? ADMIN_NAV
    : session.canAccessSecurity
      ? GUARD_NAV
      : RESIDENT_NAV;

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
      {sectionLabel ? (
        <p className="px-1 pb-2 pt-1 text-xs font-semibold uppercase tracking-widest text-accent">
          {sectionLabel}
        </p>
      ) : null}
      {nav.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = active ? item.iconActive : item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'glass-sidebar-link-active'
                : 'text-muted hover:bg-white/10 hover:text-[var(--text)]'
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
