import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';

interface StatPillProps extends ViewProps {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}

export function StatPill({ label, value, sub, valueColor, style, ...props }: StatPillProps) {
  const theme = useTheme();

  return (
    <GlassCard style={[styles.pill, style]} {...props}>
      <Text style={[styles.label, { color: theme.textSubtle }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor ?? theme.text }]}>{value}</Text>
      {sub ? <Text style={[styles.sub, { color: theme.textMuted }]}>{sub}</Text> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  pill: { minWidth: 112, padding: 12 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  sub: { fontSize: 10, marginTop: 2 },
});
