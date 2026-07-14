import Link from 'next/link';
import { formatCurrency } from '@veka/shared';

import { HOME_ILLUSTRATIONS } from '@/components/home/home-illustrations';
import type { HomeStats } from '@/lib/load-home-stats';

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function visitStatus(row: {
  checked_in_at: string | null;
  checked_out_at: string | null;
}): { label: string; pill: string } {
  if (row.checked_out_at) return { label: 'Salió', pill: 'home-status-pill' };
  if (row.checked_in_at) return { label: 'En caseta', pill: 'home-status-pill home-status-pill-green' };
  return { label: 'Esperada', pill: 'home-status-pill home-status-pill-blue' };
}

function PanelHeader({
  eyebrow,
  title,
  illustration,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  illustration: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="home-panel-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={illustration} alt="" className="home-illust home-illust-lg" />
      <div className="home-panel-header-text">
        <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{eyebrow}</p>
        <h2 className="mt-0.5 text-lg font-semibold text-[var(--text)]">{title}</h2>
      </div>
      <Link href={href} className="shrink-0 text-sm font-semibold text-[var(--accent-2)] hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}

export function AdminHomeFinancePanel({ stats }: { stats: HomeStats | null }) {
  const income = stats?.monthIncome ?? 0;
  const expense = stats?.monthExpense ?? 0;
  const balance = income - expense;
  const maxFlow = Math.max(income, expense, 1);
  const aging = stats?.agingBars ?? [];
  const maxAging = Math.max(...aging.map((bar) => bar.value), 1);
  const hasOverdue = (stats?.overdueBalance ?? 0) > 0;

  return (
    <section
      className={`home-enter home-enter-delay-2 home-panel mb-6 ${
        hasOverdue ? 'home-tone-warn' : 'home-tone-success'
      }`}
    >
      <PanelHeader
        eyebrow="Finanzas del mes"
        title="Flujo y cobranza"
        illustration={hasOverdue ? HOME_ILLUSTRATIONS.due : HOME_ILLUSTRATIONS.paid}
        href="/finanzas"
        linkLabel="Ver finanzas →"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Ingresos" value={formatCurrency(income)} tone="info" />
        <Metric label="Egresos" value={formatCurrency(expense)} tone="warn" />
        <Metric
          label="Balance del mes"
          value={formatCurrency(balance)}
          tone={balance >= 0 ? 'accent' : 'warn'}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {[
          { label: 'Ingresos', value: income, bar: 'home-bar-info' },
          { label: 'Egresos', value: expense, bar: 'home-bar-warn' },
        ].map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-muted">{row.label}</span>
              <span className="font-semibold tabular-nums text-[var(--text)]">
                {formatCurrency(row.value)}
              </span>
            </div>
            <div className="home-bar-track">
              <div
                className={`home-bar-fill ${row.bar}`}
                style={{ width: `${Math.max(4, (row.value / maxFlow) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text)]">Antigüedad de adeudos</p>
        <p className="text-xs text-muted">
          Por cobrar: {formatCurrency(stats?.overdueBalance ?? 0)}
        </p>
      </div>
      <ul className="space-y-2.5">
        {aging.map((bar) => (
          <li key={bar.label}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="text-muted">{bar.label}</span>
              <span className="tabular-nums text-[var(--text)]">{formatCurrency(bar.value)}</span>
            </div>
            <div className="home-bar-track">
              <div
                className="home-bar-fill home-bar-slate"
                style={{ width: `${Math.max(bar.value > 0 ? 4 : 0, (bar.value / maxAging) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminHomeSpacesPanel({ stats }: { stats: HomeStats | null }) {
  const reservations = stats?.upcomingReservations ?? [];
  const hasItems = reservations.length > 0;

  return (
    <section
      className={`home-enter home-enter-delay-3 home-panel mb-6 ${
        hasItems ? 'home-tone-info' : 'home-tone-neutral'
      }`}
    >
      <PanelHeader
        eyebrow="Espacios"
        title="Agenda próxima"
        illustration={HOME_ILLUSTRATIONS.calendar}
        href="/espacios"
        linkLabel="Ver espacios →"
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Metric
          label="Amenidades activas"
          value={String(stats?.activeAmenities ?? 0)}
          tone="info"
        />
        <Metric
          label="Reservas (7 días)"
          value={String(stats?.reservationsThisWeek ?? 0)}
          tone="accent"
        />
      </div>

      {reservations.length === 0 ? (
        <p className="text-sm text-muted">No hay reservas próximas.</p>
      ) : (
        <ul className="divide-y divide-[color-mix(in_srgb,var(--border)_100%,transparent)]">
          {reservations.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--text)]">{row.amenity_name}</p>
                <p className="text-xs text-muted">
                  Unidad {row.unit_identifier} · {formatWhen(row.starts_at)}
                </p>
              </div>
              <span
                className={
                  row.status === 'pending'
                    ? 'home-status-pill home-status-pill-orange'
                    : 'home-status-pill home-status-pill-blue'
                }
              >
                {row.status === 'pending' ? 'Pendiente' : 'Confirmada'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminHomeSecurityPanel({ stats }: { stats: HomeStats | null }) {
  const visits = stats?.todayVisits ?? [];
  const packages = stats?.waitingPackages ?? [];
  const hasActivity = visits.length > 0 || packages.length > 0;

  return (
    <section
      className={`home-enter home-enter-delay-4 home-panel mb-6 ${
        hasActivity ? 'home-tone-accent' : 'home-tone-neutral'
      }`}
    >
      <PanelHeader
        eyebrow="Seguridad"
        title="Visitas y recepción"
        illustration={
          (stats?.packagesWaitingCount ?? 0) > 0
            ? HOME_ILLUSTRATIONS.package
            : HOME_ILLUSTRATIONS.visit
        }
        href="/seguridad"
        linkLabel="Ver seguridad →"
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Metric label="Visitas hoy" value={String(stats?.visitsTodayCount ?? 0)} tone="accent" />
        <Metric
          label="Paquetes en caseta"
          value={String(stats?.packagesWaitingCount ?? 0)}
          tone={(stats?.packagesWaitingCount ?? 0) > 0 ? 'warn' : 'neutral'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--text)]">Visitas de hoy</p>
          {visits.length === 0 ? (
            <p className="text-sm text-muted">Nadie programado para hoy.</p>
          ) : (
            <ul className="divide-y divide-[color-mix(in_srgb,var(--border)_100%,transparent)]">
              {visits.map((visit) => {
                const status = visitStatus(visit);
                return (
                  <li key={visit.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text)]">{visit.visitor_name}</p>
                      <p className="text-xs text-muted">
                        Unidad {visit.unit_identifier} · {formatTime(visit.valid_from)}
                      </p>
                    </div>
                    <span className={status.pill}>{status.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--text)]">Paquetes pendientes</p>
          {packages.length === 0 ? (
            <p className="text-sm text-muted">Sin paquetes en caseta.</p>
          ) : (
            <ul className="divide-y divide-[color-mix(in_srgb,var(--border)_100%,transparent)]">
              {packages.map((pkg) => (
                <li key={pkg.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--text)]">
                      {pkg.carrier ?? 'Paquete'}
                    </p>
                    <p className="text-xs text-muted">
                      Unidad {pkg.unit_identifier} · {formatWhen(pkg.received_at)}
                    </p>
                  </div>
                  <span className="home-status-pill home-status-pill-orange">En caseta</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'info' | 'warn' | 'accent' | 'neutral';
}) {
  return (
    <div className={`rounded-xl px-3 py-2.5 home-tone-${tone === 'neutral' ? 'neutral' : tone}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-[var(--text)]">{value}</p>
    </div>
  );
}
