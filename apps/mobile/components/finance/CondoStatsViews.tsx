import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { accentColor, surfaceAccentBanner } from '@/constants/surface';
import { GlassCard } from '@/components/ui/GlassCard';
import { SURFACE_RADIUS } from '@/constants/surface';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@veka/shared';
import type { CategorySlice } from '@/lib/finance-stats';
import { financePeriodLabel, type FinancePeriod } from '@/lib/finance-period';

interface FlowBarProps {
  eyebrow: string;
  total: number;
  segments: { label: string; amount: number; color: string }[];
  period: FinancePeriod;
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function BarLegend({
  color,
  label,
  amount,
  percent,
}: {
  color: string;
  label: string;
  amount: number;
  percent: number;
}) {
  const theme = useTheme();

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
          {formatCurrency(amount)} · {percent.toFixed(0)}%
        </Text>
      </View>
    </View>
  );
}

function FlowBar({
  eyebrow,
  total,
  segments,
  period,
  footnote,
}: FlowBarProps & { footnote?: string }) {
  const theme = useTheme();
  const positiveSegments = segments.filter((segment) => segment.amount > 0);
  const segmentTotal = positiveSegments.reduce((sum, segment) => sum + segment.amount, 0);

  return (
    <View style={styles.flowBlock}>
      <Text style={[styles.barEyebrow, { color: theme.textSubtle }]}>
        {eyebrow} · {financePeriodLabel(period).toUpperCase()}
      </Text>
      <Text style={[styles.barTotal, { color: theme.text, fontFamily: theme.serifFamily }]}>
        {formatCurrency(total)}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: footnote ? 8 : 14 }}>
        Total del período
      </Text>
      {footnote ? (
        <Text style={{ color: theme.textSubtle, fontSize: 11, lineHeight: 16, marginBottom: 14 }}>
          {footnote}
        </Text>
      ) : null}

      <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
        {segmentTotal > 0 ? (
          positiveSegments.map((segment, index) => {
            const width = (segment.amount / segmentTotal) * 100;
            const isFirst = index === 0;
            const isLast = index === positiveSegments.length - 1;
            return (
              <View
                key={segment.label}
                style={[
                  styles.barSegment,
                  {
                    width: `${width}%`,
                    backgroundColor: segment.color,
                    borderTopLeftRadius: isFirst ? SURFACE_RADIUS.button : 0,
                    borderBottomLeftRadius: isFirst ? SURFACE_RADIUS.button : 0,
                    borderTopRightRadius: isLast ? SURFACE_RADIUS.button : 0,
                    borderBottomRightRadius: isLast ? SURFACE_RADIUS.button : 0,
                  },
                ]}
              />
            );
          })
        ) : (
          <View style={[styles.barSegment, { width: '100%', backgroundColor: theme.border }]} />
        )}
      </View>

      <View style={styles.legendRow}>
        {segments.map((segment) => (
          <BarLegend
            key={segment.label}
            color={segment.color}
            label={segment.label}
            amount={segment.amount}
            percent={segmentTotal > 0 ? (segment.amount / segmentTotal) * 100 : 0}
          />
        ))}
      </View>
    </View>
  );
}

function ExpensePieChart({ slices }: { slices: CategorySlice[] }) {
  const theme = useTheme();
  const size = 148;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;
  let cursor = 0;

  if (slices.length === 0) {
    return (
      <Text style={{ color: theme.textMuted, fontSize: 13 }}>
        Sin egresos pagados en este período.
      </Text>
    );
  }

  return (
    <View style={styles.pieLayout}>
      <Svg width={size} height={size}>
        <G>
          {slices.map((slice) => {
            const startAngle = cursor;
            const sweep = (slice.percent / 100) * 360;
            const endAngle = startAngle + sweep;
            cursor = endAngle;
            if (slice.value <= 0) return null;
            const arcEnd = sweep >= 359.9 ? startAngle + 359.99 : endAngle;
            return (
              <Path
                key={slice.label}
                d={describeArc(cx, cy, radius - 4, startAngle, arcEnd)}
                fill={slice.color}
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.pieLegend}>
        {slices.map((slice) => (
          <View key={slice.label} style={styles.pieLegendRow}>
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{slice.label}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                {formatCurrency(slice.value)} · {slice.percent.toFixed(0)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function PeriodBalanceCard({
  net,
  withCommitments,
  pendingExpenses,
  label,
}: {
  net: number;
  withCommitments: number;
  pendingExpenses: number;
  label: string;
}) {
  const theme = useTheme();
  const positive = net >= 0;

  return (
    <View
      style={[
        styles.balanceCard,
        {
          backgroundColor: positive ? `${theme.success}12` : `${theme.danger}12`,
          borderColor: positive ? `${theme.success}33` : `${theme.danger}33`,
        },
      ]}
    >
      <Text style={[styles.barEyebrow, { color: theme.textSubtle }]}>BALANCE DEL PERÍODO</Text>
      <Text
        style={[
          styles.balanceValue,
          { color: positive ? theme.success : theme.danger, fontFamily: theme.serifFamily },
        ]}
      >
        {positive ? '+' : '−'}
        {formatCurrency(Math.abs(net))}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 13 }}>{label}</Text>
      {pendingExpenses > 0 ? (
        <Text style={{ color: theme.textSubtle, fontSize: 11, marginTop: 6 }}>
          Con egresos pendientes: {formatCurrency(withCommitments)}
        </Text>
      ) : null}
    </View>
  );
}

function CollectionTargetBar({
  label,
  expected,
  collected,
  percent,
}: {
  label: string;
  expected: number;
  collected: number;
  percent: number | null;
}) {
  const theme = useTheme();
  if (expected <= 0 && collected <= 0) return null;

  const width = percent !== null ? Math.min(percent, 100) : collected > 0 ? 100 : 0;

  return (
    <View style={styles.flowBlock}>
      <Text style={[styles.barEyebrow, { color: theme.textSubtle }]}>META DE RECAUDACIÓN · {label.toUpperCase()}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 10 }}>
        Cuotas con vencimiento en el período vs pagos aprobados del edificio
      </Text>
      <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
        <View
          style={[
            styles.barSegment,
            {
              width: `${width}%`,
              backgroundColor: theme.accent,
              borderRadius: SURFACE_RADIUS.button,
            },
          ]}
        />
      </View>
      <View style={styles.legendRow}>
        <BarLegend
          color={theme.accent}
          label="Cobrado"
          amount={collected}
          percent={percent ?? (expected > 0 ? 0 : 100)}
        />
        <BarLegend
          color={theme.border}
          label="Meta"
          amount={expected}
          percent={expected > 0 ? 100 - (percent ?? 0) : 0}
        />
      </View>
    </View>
  );
}

function BudgetExecutionBlock({
  percentUsed,
  totalBudget,
  totalActual,
  highlights,
  period,
}: {
  percentUsed: number | null;
  totalBudget: number;
  totalActual: number;
  highlights: { label: string; percentUsed: number; actual: number; budget: number }[];
  period: FinancePeriod;
}) {
  const theme = useTheme();
  if (totalBudget <= 0 && totalActual <= 0) {
    return (
      <Text style={{ color: theme.textMuted, fontSize: 13 }}>
        Sin presupuesto anual registrado para comparar.
      </Text>
    );
  }

  const pct = percentUsed ?? 0;
  const barColor = pct > 100 ? theme.danger : pct > 85 ? theme.accent3 : theme.success;

  return (
    <View style={styles.flowBlock}>
      <Text style={[styles.barEyebrow, { color: theme.textSubtle }]}>
        EJECUCIÓN PRESUPUESTAL · {financePeriodLabel(period).toUpperCase()}
      </Text>
      <Text style={[styles.barTotal, { color: theme.text, fontFamily: theme.serifFamily, fontSize: 22 }]}>
        {percentUsed !== null ? `${percentUsed.toFixed(0)}%` : '—'}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 10 }}>
        {formatCurrency(totalActual)} de {formatCurrency(totalBudget)} presupuestados en egresos
      </Text>
      <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
        <View
          style={[
            styles.barSegment,
            {
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: barColor,
              borderRadius: SURFACE_RADIUS.button,
            },
          ]}
        />
      </View>
      {highlights.length > 0 ? (
        <View style={{ marginTop: 12, gap: 6 }}>
          {highlights.map((row) => (
            <Text key={row.label} style={{ color: theme.textMuted, fontSize: 12 }}>
              {row.label}: {formatCurrency(row.actual)} / {formatCurrency(row.budget)} (
              {row.percentUsed.toFixed(0)}%)
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export interface CondoTransparencySummaryProps {
  income: { cuotas: number; otros: number; total: number };
  expenses: { paid: number; pending: number; total: number };
  categorySlices: CategorySlice[];
  totalFunds: number;
  period: FinancePeriod;
  periodBalance: { net: number; withCommitments: number; label: string };
  collection: { expected: number; collected: number; percent: number | null };
  showCollection: boolean;
  collectionLabel: string;
  budget: {
    totalBudget: number;
    totalActual: number;
    percentUsed: number | null;
    highlights: { label: string; percentUsed: number; actual: number; budget: number }[];
  };
}

export function CondoTransparencySummary({
  income,
  expenses,
  categorySlices,
  totalFunds,
  period,
  periodBalance,
  collection,
  showCollection,
  collectionLabel,
  budget,
}: CondoTransparencySummaryProps) {
  const theme = useTheme();
  const fundsNegative = totalFunds < 0;

  return (
    <GlassCard style={{ marginTop: 12 }}>
      <FlowBar
        eyebrow="INGRESOS"
        total={income.total}
        period={period}
        footnote="Las cuotas cobradas suman pagos aprobados de tu edificio. Los demás ingresos los registra administración."
        segments={[
          { label: 'Cuotas cobradas', amount: income.cuotas, color: theme.accent },
          { label: 'Otros ingresos', amount: income.otros, color: theme.success },
        ]}
      />

      {showCollection ? (
        <>
          <View style={[styles.divider, { borderTopColor: theme.border }]} />
          <CollectionTargetBar
            label={collectionLabel}
            expected={collection.expected}
            collected={collection.collected}
            percent={collection.percent}
          />
        </>
      ) : null}

      <View style={[styles.divider, { borderTopColor: theme.border }]} />

      <FlowBar
        eyebrow="EGRESOS"
        total={expenses.total}
        period={period}
        segments={[
          { label: 'Pagado', amount: expenses.paid, color: theme.success },
          { label: 'Pendiente', amount: expenses.pending, color: theme.accent3 },
        ]}
      />

      <View style={[styles.divider, { borderTopColor: theme.border }]} />

      <PeriodBalanceCard
        net={periodBalance.net}
        withCommitments={periodBalance.withCommitments}
        pendingExpenses={expenses.pending}
        label={periodBalance.label}
      />

      <View style={[styles.divider, { borderTopColor: theme.border }]} />

      <BudgetExecutionBlock
        percentUsed={budget.percentUsed}
        totalBudget={budget.totalBudget}
        totalActual={budget.totalActual}
        highlights={budget.highlights}
        period={period}
      />

      <View style={[styles.divider, { borderTopColor: theme.border }]} />

      <Text style={[styles.barEyebrow, { color: theme.textSubtle, marginBottom: 12 }]}>
        EGRESOS POR CATEGORÍA
      </Text>
      <ExpensePieChart slices={categorySlices} />

      <View style={[styles.fundsRow, { borderTopColor: theme.border }]}>
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>Fondos del condominio</Text>
        <Text
          style={{
            color: fundsNegative ? theme.danger : theme.accent2,
            fontSize: 16,
            fontWeight: '700',
          }}
        >
          {formatCurrency(totalFunds)}
        </Text>
      </View>
      {fundsNegative ? (
        <View style={[styles.fundsWarning, surfaceAccentBanner(theme, 'danger')]}>
          <Text style={{ color: accentColor(theme, 'danger'), fontSize: 12, lineHeight: 18 }}>
            El saldo consolidado es negativo. La administración debe revisar ingresos, egresos y conciliación de
            fondos.
          </Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  flowBlock: {},
  barEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  barTotal: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  barTrack: {
    flexDirection: 'row',
    height: 14,
    borderRadius: SURFACE_RADIUS.button,
    overflow: 'hidden',
  },
  barSegment: { height: '100%' },
  legendRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  legendItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: 18,
  },
  pieLayout: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  pieLegend: { flex: 1, gap: 8 },
  pieLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fundsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fundsWarning: { marginTop: 12 },
  balanceCard: {
    borderWidth: 1,
    borderRadius: SURFACE_RADIUS.card,
    padding: 14,
  },
  balanceValue: { fontSize: 26, fontWeight: '700', marginTop: 4, marginBottom: 4 },
});
