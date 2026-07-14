import { StyleSheet, Text, type ViewProps } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';

interface StatPillProps extends ViewProps {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  /** Fits three pills in one row without horizontal scroll. */
  dense?: boolean;
  shadow?: 'default' | 'compact' | 'subtle' | 'none';
}

export function StatPill({
  label,
  value,
  sub,
  valueColor,
  dense,
  shadow,
  style,
  ...props
}: StatPillProps) {
  const theme = useTheme();

  return (
    <GlassCard
      shadow={shadow ?? (dense ? 'none' : 'subtle')}
      padding={dense ? 10 : 12}
      style={[styles.pill, dense && styles.pillDense, style]}
      {...props}
    >
      <Text style={[styles.label, dense && styles.labelDense, { color: theme.textSubtle }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.value, dense && styles.valueDense, { color: valueColor ?? theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {value}
      </Text>
      {sub ? (
        <Text style={[styles.sub, dense && styles.subDense, { color: theme.textMuted }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  pill: { minWidth: 112 },
  pillDense: { minWidth: 0, flex: 1 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  labelDense: { fontSize: 9, letterSpacing: 0.4 },
  value: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  valueDense: { fontSize: 17, marginTop: 1 },
  sub: { fontSize: 10, marginTop: 2 },
  subDense: { fontSize: 9, marginTop: 1 },
});
