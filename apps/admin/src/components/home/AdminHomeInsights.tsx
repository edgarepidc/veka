import Link from 'next/link';
import { formatCurrency } from '@veka/shared';

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

export function AdminHomeFinancePanel({ stats }: { stats: HomeStats | null }) {
  const income = stats?.monthIncome ?? 0;
  const expense = stats?.monthExpense ?? 0;
  const balance = income - expense;
  const maxFlow = Math.max(income, expense, 1);
  const aging = stats?.agingBars ?? [];
  const maxAging = Math.max(...aging.map((bar) => bar.value), 1);

  return (
    <section className="home-enter home-enter-delay-2 home-panel home-tone-neutral mb-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Finanzas del mes</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Flujo y cobranza</h2>
        </div>
        <Link href="/finanzas" className="text-sm font-semibold text-[var(--accent-2)] hover:underline">
          Ver finanzas →
        </Link>
      </div>

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

  return (
    <section className="home-enter home-enter-delay-3 home-panel home-tone-info mb-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Espacios</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Agenda próxima</h2>
        </div>
        <Link href="/espacios" className="text-sm font-semibold text-[var(--accent-2)] hover:underline">
          Ver espacios →
        </Link>
      </div>

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
              <span className="shrink-0 rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {row.status === 'pending' ? 'Pendiente' : 'Confirmada'}
              </span>
            </li>
          ))}
        </ul>
      )}
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
