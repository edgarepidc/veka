import Link from 'next/link';
import type { IconType } from 'react-icons';
import {
  IoCardOutline,
  IoConstructOutline,
  IoCubeOutline,
  IoPeopleOutline,
} from 'react-icons/io5';

import type { HomeStats } from '@/lib/load-home-stats';

type PulseItem = {
  label: string;
  value: number;
  href: string;
  icon: IconType;
  hint: string;
};

export function AdminHomePulseStrip({ stats }: { stats: HomeStats | null }) {
  const items: PulseItem[] = [
    {
      label: 'Con adeudo',
      value: stats?.overdueUnitCount ?? 0,
      href: '/finanzas',
      icon: IoCardOutline,
      hint: 'unidades',
    },
    {
      label: 'Tickets abiertos',
      value: stats?.openTicketCount ?? 0,
      href: '/mantenimiento',
      icon: IoConstructOutline,
      hint: 'mantenimiento',
    },
    {
      label: 'Visitas hoy',
      value: stats?.visitsTodayCount ?? 0,
      href: '/seguridad',
      icon: IoPeopleOutline,
      hint: 'programadas',
    },
    {
      label: 'Paquetes',
      value: stats?.packagesWaitingCount ?? 0,
      href: '/seguridad',
      icon: IoCubeOutline,
      hint: 'en caseta',
    },
  ];

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`home-enter home-enter-delay-${index + 1} group home-pulse-pill`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{item.value}</p>
                <p className="mt-0.5 text-xs text-muted">{item.hint}</p>
              </div>
              <span className="home-module-icon shrink-0 text-[var(--accent)] transition group-hover:scale-105">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
