import Link from 'next/link';
import type { IconType } from 'react-icons';
import {
  IoCardOutline,
  IoConstructOutline,
  IoCubeOutline,
  IoPeopleOutline,
} from 'react-icons/io5';

import { formatHomeStatMoney, type HomeStats } from '@/lib/load-home-stats';

type PulseTone = 'neutral' | 'warn' | 'info' | 'accent';

type PulseItem = {
  label: string;
  value: number;
  href: string;
  icon: IconType;
  hint: string;
  tone: PulseTone;
};

const TONE_CLASS: Record<PulseTone, string> = {
  neutral: 'home-tone-neutral',
  warn: 'home-tone-warn',
  info: 'home-tone-info',
  accent: 'home-tone-accent',
};

export function AdminHomePulseStrip({ stats }: { stats: HomeStats | null }) {
  const items: PulseItem[] = [
    {
      label: 'Con adeudo',
      value: stats?.overdueUnitCount ?? 0,
      href: '/finanzas',
      icon: IoCardOutline,
      hint: 'unidades',
      tone: (stats?.overdueUnitCount ?? 0) > 0 ? 'warn' : 'neutral',
    },
    {
      label: 'Tickets abiertos',
      value: stats?.openTicketCount ?? 0,
      href: '/mantenimiento',
      icon: IoConstructOutline,
      hint: 'mantenimiento',
      tone: (stats?.openTicketCount ?? 0) > 0 ? 'info' : 'neutral',
    },
    {
      label: 'Visitas hoy',
      value: stats?.visitsTodayCount ?? 0,
      href: '/seguridad',
      icon: IoPeopleOutline,
      hint: 'programadas',
      tone: 'accent',
    },
    {
      label: 'Paquetes',
      value: stats?.packagesWaitingCount ?? 0,
      href: '/seguridad',
      icon: IoCubeOutline,
      hint: 'en caseta',
      tone: (stats?.packagesWaitingCount ?? 0) > 0 ? 'warn' : 'neutral',
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
            className={`home-enter home-enter-delay-${index + 1} group home-pulse-pill ${TONE_CLASS[item.tone]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{item.value}</p>
                <p className="mt-0.5 text-xs text-muted">{item.hint}</p>
              </div>
              <span className="home-icon-chip shrink-0 transition group-hover:scale-105">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function AdminHomeFundRow({ stats }: { stats: HomeStats | null }) {
  const funds = [
    {
      label: 'Fondo operativo',
      value: stats ? formatHomeStatMoney(stats.operatingBalance) : '—',
      tone: 'home-tone-neutral' as const,
    },
    {
      label: 'Fondo reserva',
      value: stats ? formatHomeStatMoney(stats.reserveBalance) : '—',
      tone: 'home-tone-info' as const,
    },
    {
      label: 'Unidades al día',
      value:
        stats?.unitsOnTimePercent != null
          ? `${stats.unitsOnTimePercent}% · ${stats.totalUnits} unidades`
          : '—',
      tone: 'home-tone-accent' as const,
    },
  ];

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      {funds.map((fund, index) => (
        <div
          key={fund.label}
          className={`home-enter home-enter-delay-${index + 2} home-fund-pill ${fund.tone} px-4 py-3`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{fund.label}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text)]">{fund.value}</p>
        </div>
      ))}
    </div>
  );
}
