import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { formatCurrency } from '@veka/shared';

import { FilterBar } from '@/components/ui/TabStrip';
import { useTheme } from '@/hooks/useTheme';
import type { CompareSlice } from '@/lib/finance-stats';
import { FINANCE_PERIOD_OPTIONS, type FinancePeriod } from '@/lib/finance-period';

export function FinancePeriodFilter({
  period,
  onChange,
}: {
  period: FinancePeriod;
  onChange: (period: FinancePeriod) => void;
}) {
  return (
    <FilterBar
      items={FINANCE_PERIOD_OPTIONS}
      active={period}
      onChange={(key) => onChange(key as FinancePeriod)}
    />
  );
}

export function FinanceCompareChart({
  title,
  items,
}: {
  title: string;
  items: CompareSlice[];
}) {
  const theme = useTheme();
  const max = Math.max(...items.map((item) => item.value), 1);
  const chartWidth = 280;
  const barHeight = 22;
  const gap = 14;

  return (
    <View>
      <Text style={[styles.title, { color: theme.textSubtle }]}>{title}</Text>
      {items.map((item, index) => {
        const width = Math.max(8, (item.value / max) * chartWidth);
        return (
          <View key={item.label} style={{ marginTop: index === 0 ? 10 : gap }}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{item.label}</Text>
              <Text style={[styles.value, { color: theme.text }]}>{formatCurrency(item.value)}</Text>
            </View>
            <Svg width={chartWidth} height={barHeight} style={{ marginTop: 6 }}>
              <Rect x={0} y={0} width={chartWidth} height={barHeight} rx={8} fill={theme.surfaceMuted} />
              <Rect x={0} y={0} width={width} height={barHeight} rx={8} fill={item.color} />
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

export function FinanceMonthlyChart({
  title,
  paidBuckets,
  owedBuckets,
}: {
  title: string;
  paidBuckets: { key: string; label: string; value: number }[];
  owedBuckets: { key: string; label: string; value: number }[];
}) {
  const theme = useTheme();
  const keys = [...new Set([...paidBuckets.map((b) => b.key), ...owedBuckets.map((b) => b.key)])].sort();
  const paidMap = new Map(paidBuckets.map((b) => [b.key, b]));
  const owedMap = new Map(owedBuckets.map((b) => [b.key, b]));

  if (keys.length === 0) {
    return (
      <View>
        <Text style={[styles.title, { color: theme.textSubtle }]}>{title}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>Sin movimientos en este período.</Text>
      </View>
    );
  }

  const max = Math.max(
    ...keys.flatMap((key) => [paidMap.get(key)?.value ?? 0, owedMap.get(key)?.value ?? 0]),
    1,
  );
  const chartHeight = 88;
  const barWidth = 12;
  const groupGap = 18;
  const chartWidth = keys.length * (barWidth * 2 + 6 + groupGap);

  return (
    <View>
      <Text style={[styles.title, { color: theme.textSubtle }]}>{title}</Text>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.accent }]} />
          <Text style={{ color: theme.textMuted, fontSize: 10 }}>Pagado</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.danger }]} />
          <Text style={{ color: theme.textMuted, fontSize: 10 }}>Pendiente</Text>
        </View>
      </View>
      <Svg width={chartWidth} height={chartHeight}>
        {keys.map((key, index) => {
          const paid = paidMap.get(key)?.value ?? 0;
          const owed = owedMap.get(key)?.value ?? 0;
          const paidHeight = (paid / max) * chartHeight;
          const owedHeight = (owed / max) * chartHeight;
          const x = index * (barWidth * 2 + 6 + groupGap);
          return (
            <React.Fragment key={key}>
              <Rect
                x={x}
                y={chartHeight - paidHeight}
                width={barWidth}
                height={paidHeight}
                rx={4}
                fill={theme.accent}
              />
              <Rect
                x={x + barWidth + 6}
                y={chartHeight - owedHeight}
                width={barWidth}
                height={owedHeight}
                rx={4}
                fill={theme.danger}
              />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={[styles.monthLabels, { width: chartWidth }]}>
        {keys.map((key) => (
          <Text key={key} style={[styles.monthLabel, { color: theme.textSubtle, width: barWidth * 2 + 6 + groupGap }]}>
            {paidMap.get(key)?.label ?? owedMap.get(key)?.label ?? key}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '600' },
  value: { fontSize: 12, fontWeight: '700' },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 10, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  monthLabels: { flexDirection: 'row', marginTop: 4 },
  monthLabel: { fontSize: 9, textAlign: 'center' },
});
