import Link from 'next/link';
import type { IconType } from 'react-icons';
import {
  IoCalendarOutline,
  IoCardOutline,
  IoChatbubbleEllipsesOutline,
  IoConstructOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

import { formatHomeStatMoney, type HomeStats } from '@/lib/load-home-stats';

const modules: {
  title: string;
  description: string;
  href: string;
  icon: IconType;
}[] = [
  {
    title: 'Finanzas',
    description: 'Cuotas, pagos, egresos y fondos.',
    href: '/finanzas',
    icon: IoCardOutline,
  },
  {
    title: 'Comunidad',
    description: 'Avisos, encuestas y documentos.',
    href: '/comunidad',
    icon: IoChatbubbleEllipsesOutline,
  },
  {
    title: 'Espacios',
    description: 'Amenidades y reservas.',
    href: '/espacios',
    icon: IoCalendarOutline,
  },
  {
    title: 'Seguridad',
    description: 'Visitas QR y paquetería.',
    href: '/seguridad',
    icon: IoShieldCheckmarkOutline,
  },
  {
    title: 'Mantenimiento',
    description: 'Tickets, calendarios y evidencia.',
    href: '/mantenimiento',
    icon: IoConstructOutline,
  },
  {
    title: 'Configuración',
    description: 'Unidades, equipo y perfil.',
    href: '/configuracion',
    icon: IoSettingsOutline,
  },
];

export function AdminHomeFundRow({ stats }: { stats: HomeStats | null }) {
  const funds = [
    {
      label: 'Fondo operativo',
      value: stats ? formatHomeStatMoney(stats.operatingBalance) : '—',
    },
    {
      label: 'Fondo reserva',
      value: stats ? formatHomeStatMoney(stats.reserveBalance) : '—',
    },
    {
      label: 'Unidades al día',
      value: stats?.unitsOnTimePercent != null ? `${stats.unitsOnTimePercent}%` : '—',
    },
  ];

  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-3">
      {funds.map((fund, index) => (
        <div
          key={fund.label}
          className={`home-enter home-enter-delay-${index + 2} home-fund-pill px-4 py-3`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{fund.label}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text)]">{fund.value}</p>
        </div>
      ))}
    </div>
  );
}

export function AdminHomeModuleGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modules.map((module, index) => {
        const Icon = module.icon;
        return (
          <Link
            key={module.href}
            href={module.href}
            className={`home-enter home-enter-delay-${Math.min(index + 1, 6)} home-module-tile group`}
          >
            <span className="home-module-icon text-[var(--accent)]">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">{module.title}</h2>
              <p className="mt-1 text-sm text-muted">{module.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
