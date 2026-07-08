import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { SURFACE_RADIUS } from '@/constants/surface';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@veka/shared';
import type { CompareSlice } from '@/lib/finance-stats';
import { financePeriodLabel, type FinancePeriod } from '@/lib/finance-period';

interface CondoGradientStatProps {
  label: string;
  value: string;
  sub?: string;
  colors: readonly [string, string];
  style?: StyleProp<ViewStyle>;
}

function CondoGradientStat({ label, value, sub, colors, style }: CondoGradientStatProps) {
  const theme = useTheme();

  return (
    <LinearGradient
      colors={[...colors]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientTile, style]}
    >
      <Text style={[styles.tileLabel, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.tileValue, { color: theme.onAccent, fontFamily: theme.sansFamily }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      {sub ? (
        <Text style={[styles.tileSub, { color: 'rgba(255,255,255,0.75)' }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </LinearGradient>
  );
}

interface CondoStatsChipsProps {
  compare: CompareSlice[];
  scopeCompare: CompareSlice[];
  totalFunds: number;
  period: FinancePeriod;
}

export function CondoStatsChips({ compare, scopeCompare, totalFunds, period }: CondoStatsChipsProps) {
  const theme = useTheme();
  const periodSub = financePeriodLabel(period).toLowerCase();
  const paid = compare.find((s) => s.label === 'Pagado');
  const pending = compare.find((s) => s.label === 'Pendiente');

  return (
    <View style={styles.chipsGrid}>
      <View style={styles.chipsRow}>
        {paid ? (
          <CondoGradientStat
            label="Pagado"
            value={formatCurrency(paid.value)}
            sub={periodSub}
            colors={[theme.success, theme.accent2]}
            style={styles.chipHalf}
          />
        ) : null}
        {pending ? (
          <CondoGradientStat
            label="Pendiente"
            value={formatCurrency(pending.value)}
            sub={periodSub}
            colors={[theme.danger, theme.accent3]}
            style={styles.chipHalf}
          />
        ) : null}
      </View>
      <View style={styles.chipsRow}>
        {scopeCompare.map((slice) => (
          <CondoGradientStat
            key={slice.label}
            label={slice.label}
            value={formatCurrency(slice.value)}
            sub="egresos"
            colors={
              slice.label === 'General'
                ? ([theme.purple, theme.accent] as const)
                : ([theme.accent2, theme.accent] as const)
            }
            style={scopeCompare.length > 1 ? styles.chipThird : styles.chipHalf}
          />
        ))}
        <CondoGradientStat
          label="Fondos"
          value={formatCurrency(totalFunds)}
          sub="saldo actual"
          colors={[theme.accent, theme.accent2]}
          style={scopeCompare.length > 1 ? styles.chipThird : styles.chipHalf}
        />
      </View>
    </View>
  );
}

interface CondoStatsBarProps {
  compare: CompareSlice[];
  scopeCompare: CompareSlice[];
  totalFunds: number;
  period: FinancePeriod;
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

export function CondoStatsBar({ compare, scopeCompare, totalFunds, period }: CondoStatsBarProps) {
  const theme = useTheme();
  const paid = compare.find((s) => s.label === 'Pagado')?.value ?? 0;
  const pending = compare.find((s) => s.label === 'Pendiente')?.value ?? 0;
  const total = paid + pending;
  const paidPct = total > 0 ? (paid / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;
  const scopeTotal = scopeCompare.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <GlassCard>
      <Text style={[styles.barEyebrow, { color: theme.textSubtle }]}>
        EGRESOS · {financePeriodLabel(period).toUpperCase()}
      </Text>
      <Text style={[styles.barTotal, { color: theme.text, fontFamily: theme.serifFamily }]}>
        {formatCurrency(total)}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 14 }}>Total del período</Text>

      <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
        {paidPct > 0 ? (
          <View
            style={[
              styles.barSegment,
              {
                width: `${paidPct}%`,
                backgroundColor: theme.success,
                borderTopLeftRadius: SURFACE_RADIUS.button,
                borderBottomLeftRadius: SURFACE_RADIUS.button,
                borderTopRightRadius: pendingPct > 0 ? 0 : SURFACE_RADIUS.button,
                borderBottomRightRadius: pendingPct > 0 ? 0 : SURFACE_RADIUS.button,
              },
            ]}
          />
        ) : null}
        {pendingPct > 0 ? (
          <View
            style={[
              styles.barSegment,
              {
                width: `${pendingPct}%`,
                backgroundColor: theme.accent3,
                borderTopRightRadius: SURFACE_RADIUS.button,
                borderBottomRightRadius: SURFACE_RADIUS.button,
                borderTopLeftRadius: paidPct > 0 ? 0 : SURFACE_RADIUS.button,
                borderBottomLeftRadius: paidPct > 0 ? 0 : SURFACE_RADIUS.button,
              },
            ]}
          />
        ) : null}
        {total === 0 ? (
          <View style={[styles.barSegment, { width: '100%', backgroundColor: theme.border }]} />
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <BarLegend color={theme.success} label="Pagado" amount={paid} percent={paidPct} />
        <BarLegend color={theme.accent3} label="Pendiente" amount={pending} percent={pendingPct} />
      </View>

      {scopeCompare.length > 0 && scopeTotal > 0 ? (
        <>
          <Text style={[styles.barEyebrow, { color: theme.textSubtle, marginTop: 16, marginBottom: 8 }]}>
            POR ALCANCE
          </Text>
          <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted, height: 10 }]}>
            {scopeCompare.map((slice, index) => {
              const width = (slice.value / scopeTotal) * 100;
              const isFirst = index === 0;
              const isLast = index === scopeCompare.length - 1;
              return (
                <View
                  key={slice.label}
                  style={[
                    styles.barSegment,
                    {
                      width: `${width}%`,
                      backgroundColor: slice.color,
                      borderTopLeftRadius: isFirst ? 6 : 0,
                      borderBottomLeftRadius: isFirst ? 6 : 0,
                      borderTopRightRadius: isLast ? 6 : 0,
                      borderBottomRightRadius: isLast ? 6 : 0,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={[styles.legendRow, { marginTop: 10 }]}>
            {scopeCompare.map((slice) => (
              <BarLegend
                key={slice.label}
                color={slice.color}
                label={slice.label}
                amount={slice.value}
                percent={scopeTotal > 0 ? (slice.value / scopeTotal) * 100 : 0}
              />
            ))}
          </View>
        </>
      ) : null}

      <View style={[styles.fundsRow, { borderTopColor: theme.border }]}>
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>Fondos del condominio</Text>
        <Text style={{ color: theme.accent2, fontSize: 16, fontWeight: '700' }}>{formatCurrency(totalFunds)}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  chipsGrid: { gap: 8, paddingTop: 12 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chipHalf: { flex: 1 },
  chipThird: { flex: 1 },
  gradientTile: {
    borderRadius: SURFACE_RADIUS.card,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 76,
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tileValue: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  tileSub: { fontSize: 9, marginTop: 2 },
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
  fundsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
