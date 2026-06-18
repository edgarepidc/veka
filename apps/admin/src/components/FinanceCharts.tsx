'use client';

import type { ChartBar, ChartSlice } from '@veka/shared';
import { formatCurrency } from '@veka/shared';

export function ExpensePieChart({ slices }: { slices: ChartSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) {
    return <p className="py-8 text-center text-sm text-subtle">Sin egresos en el periodo.</p>;
  }

  let angle = -90;
  const segments = slices.map((slice) => {
    const pct = slice.value / total;
    const sweep = pct * 360;
    const start = angle;
    angle += sweep;
    return { ...slice, pct, start, sweep };
  });

  function arcPath(startAngle: number, sweepAngle: number, radius = 42): string {
    if (sweepAngle >= 359.9) {
      return `M 50 8 A ${radius} ${radius} 0 1 1 49.99 8 Z`;
    }
    const start = polar(startAngle, radius);
    const end = polar(startAngle + sweepAngle, radius);
    const large = sweepAngle > 180 ? 1 : 0;
    return `M 50 50 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y} Z`;
  }

  function polar(deg: number, radius: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 100 100" className="mx-auto h-40 w-40 shrink-0">
        {segments.map((segment) => (
          <path
            key={segment.label}
            d={arcPath(segment.start, segment.sweep)}
            fill={segment.color}
            opacity={0.92}
          />
        ))}
        <circle cx="50" cy="50" r="22" fill="rgba(15,23,42,0.85)" />
        <text x="50" y="52" textAnchor="middle" fontSize="7" fill="#e2e8f0" fontWeight="700">
          {Math.round((slices[0]?.value ?? 0) / total * 100) || 0}%
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
              <span className="truncate text-[var(--text)]">{segment.label}</span>
            </span>
            <span className="shrink-0 text-muted">
              {formatCurrency(segment.value)}{' '}
              <span className="text-subtle">({Math.round(segment.pct * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendBarChart({
  bars,
  valueFormatter = (v) => formatCurrency(v),
}: {
  bars: ChartBar[];
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  if (bars.every((b) => b.value === 0)) {
    return <p className="py-8 text-center text-sm text-subtle">Sin datos en el periodo.</p>;
  }

  return (
    <div className="flex h-48 items-end gap-2">
      {bars.map((bar) => {
        const height = Math.max(8, (bar.value / max) * 100);
        return (
          <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="text-[10px] font-semibold text-accent">{bar.value > 0 ? valueFormatter(bar.value) : ''}</span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all"
                style={{ height: `${height}%` }}
                title={`${bar.label}: ${valueFormatter(bar.value)}`}
              />
            </div>
            <span className="text-center text-[10px] text-subtle">{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SignedBarChart({
  bars,
  valueFormatter = (v) => formatCurrency(v),
}: {
  bars: ChartBar[];
  valueFormatter?: (value: number) => string;
}) {
  if (bars.every((bar) => bar.value === 0)) {
    return <p className="py-8 text-center text-sm text-subtle">Sin flujo en el periodo.</p>;
  }

  const maxAbs = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1);

  return (
    <div className="flex h-48 items-center gap-2">
      {bars.map((bar) => {
        const positive = bar.value >= 0;
        const height = Math.max(8, (Math.abs(bar.value) / maxAbs) * 45);
        return (
          <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span
              className={`text-[10px] font-semibold ${positive ? 'text-accent' : 'text-red-300'}`}
            >
              {bar.value !== 0 ? valueFormatter(bar.value) : ''}
            </span>
            <div className="flex h-24 w-full items-center justify-center">
              <div
                className={`w-full max-w-[2.5rem] rounded-lg ${
                  positive
                    ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                    : 'bg-gradient-to-b from-red-600 to-red-400'
                }`}
                style={{ height: `${height}%` }}
                title={`${bar.label}: ${valueFormatter(bar.value)}`}
              />
            </div>
            <span className="text-center text-[10px] text-subtle">{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HorizontalBarChart({
  bars,
  maxValue = 100,
  valueFormatter = (v) => `${v}%`,
}: {
  bars: ChartBar[];
  maxValue?: number;
  valueFormatter?: (value: number) => string;
}) {
  if (bars.length === 0 || bars.every((bar) => bar.value === 0)) {
    return <p className="py-8 text-center text-sm text-subtle">Sin datos para mostrar.</p>;
  }

  const scale = Math.max(maxValue ?? 0, ...bars.map((bar) => bar.value), 1);

  return (
    <ul className="space-y-3">
      {bars.map((bar) => (
        <li key={bar.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-[var(--text)]">{bar.label}</span>
            <span className="shrink-0 text-muted">
              {valueFormatter(bar.value)}
              {bar.meta ? <span className="text-subtle"> · {bar.meta}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              style={{ width: `${Math.max(4, (bar.value / scale) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ComparisonBarChart({
  income,
  expenses,
}: {
  income: number;
  expenses: number;
}) {
  const max = Math.max(income, expenses, 1);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        { label: 'Ingresos', value: income, color: 'from-emerald-600 to-emerald-400' },
        { label: 'Egresos', value: expenses, color: 'from-sky-600 to-sky-400' },
      ].map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted">{item.label}</span>
            <span className="font-semibold text-[var(--text)]">{formatCurrency(item.value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface GroupedBarRow {
  label: string;
  budget: number;
  actual: number;
}

export function BudgetVsActualChart({
  rows,
}: {
  rows: GroupedBarRow[];
}) {
  if (rows.length === 0 || rows.every((row) => row.budget === 0 && row.actual === 0)) {
    return <p className="py-8 text-center text-sm text-subtle">Sin presupuesto ni egresos en el periodo.</p>;
  }

  const max = Math.max(...rows.flatMap((row) => [row.budget, row.actual]), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-subtle">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded bg-slate-400/80" />
          Presupuesto
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded bg-emerald-400" />
          Real
        </span>
      </div>
      <ul className="space-y-4">
        {rows.map((row) => {
          const over = row.actual > row.budget && row.budget > 0;
          return (
            <li key={row.label}>
              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[var(--text)]">{row.label}</span>
                <span className="shrink-0 text-muted">
                  {formatCurrency(row.actual)}
                  <span className="text-subtle"> / {formatCurrency(row.budget)}</span>
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-slate-400/70"
                    style={{ width: `${Math.max(row.budget > 0 ? 4 : 0, (row.budget / max) * 100)}%` }}
                    title={`Presupuesto: ${formatCurrency(row.budget)}`}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${
                      over
                        ? 'bg-gradient-to-r from-red-500 to-red-400'
                        : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                    }`}
                    style={{ width: `${Math.max(row.actual > 0 ? 4 : 0, (row.actual / max) * 100)}%` }}
                    title={`Real: ${formatCurrency(row.actual)}`}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
