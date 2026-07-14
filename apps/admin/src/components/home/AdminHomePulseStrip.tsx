import Link from 'next/link';

import { HOME_ILLUSTRATIONS } from '@/components/home/home-illustrations';
import { formatHomeStatMoney, type HomeStats } from '@/lib/load-home-stats';

type PulseItem = {
  label: string;
  value: number;
  href: string;
  hint: string;
  illustration: string;
};

export function AdminHomePulseStrip({ stats }: { stats: HomeStats | null }) {
  const overdue = stats?.overdueUnitCount ?? 0;
  const tickets = (stats?.openTicketCount ?? 0) + (stats?.inProgressTicketCount ?? 0);
  const visits = stats?.visitsTodayCount ?? 0;
  const packages = stats?.packagesWaitingCount ?? 0;

  const items: PulseItem[] = [
    {
      label: 'Con adeudo',
      value: overdue,
      href: '/finanzas',
      hint: 'unidades',
      illustration: overdue > 0 ? HOME_ILLUSTRATIONS.finance : HOME_ILLUSTRATIONS.paid,
    },
    {
      label: 'Tickets abiertos',
      value: tickets,
      href: '/mantenimiento',
      hint: 'mantenimiento',
      illustration: HOME_ILLUSTRATIONS.maintenance,
    },
    {
      label: 'Visitas hoy',
      value: visits,
      href: '/seguridad',
      hint: 'programadas',
      illustration: HOME_ILLUSTRATIONS.visit,
    },
    {
      label: 'Paquetes',
      value: packages,
      href: '/seguridad',
      hint: 'en caseta',
      illustration: HOME_ILLUSTRATIONS.package,
    },
  ];

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <Link
          key={item.label}
          href={item.href}
          className={`home-enter home-enter-delay-${index + 1} group home-pulse-pill`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{item.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{item.value}</p>
              <p className="mt-0.5 text-xs text-muted">{item.hint}</p>
            </div>
            <span className="home-illust-frame transition duration-200 group-hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.illustration} alt="" className="home-illust" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

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
      value:
        stats?.unitsOnTimePercent != null
          ? `${stats.unitsOnTimePercent}% · ${stats.totalUnits} unidades`
          : '—',
    },
  ];

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
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
