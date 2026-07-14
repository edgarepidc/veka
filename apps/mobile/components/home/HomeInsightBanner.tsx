import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { useTheme } from '@/hooks/useTheme';
import type { AppTheme } from '@/constants/theme';
import { SURFACE_RADIUS, surfaceSubtleShadow } from '@/constants/surface';

export type HomeInsightKind =
  | 'paid'
  | 'due'
  | 'finance'
  | 'package'
  | 'notice'
  | 'maintenance'
  | 'account'
  | 'spaces';

export type HomeInsightTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'purple';

export type HomeInsightPollBar = {
  label: string;
  votes: number;
};

const ILLUSTRATIONS: Record<HomeInsightKind, ImageSourcePropType> = {
  paid: require('@/assets/home/home-insight-paid.png'),
  due: require('@/assets/home/home-insight-calendar.png'),
  finance: require('@/assets/home/home-insight-finance.png'),
  package: require('@/assets/home/home-insight-package.png'),
  notice: require('@/assets/home/home-insight-notice.png'),
  maintenance: require('@/assets/home/home-insight-maintenance.png'),
  account: require('@/assets/home/home-insight-finance.png'),
  spaces: require('@/assets/home/home-insight-calendar.png'),
};

function toneColors(theme: AppTheme, tone: HomeInsightTone) {
  const isDark = theme.mode === 'dark';
  const map: Record<HomeInsightTone, string> = {
    neutral: isDark ? theme.surfaceMuted : '#F4F3EF',
    success: isDark ? `${theme.success}22` : `${theme.success}14`,
    warning: isDark ? `${theme.accent3}22` : `${theme.accent3}14`,
    info: isDark ? `${theme.accent2}22` : `${theme.accent2}14`,
    danger: isDark ? `${theme.danger}22` : `${theme.danger}12`,
    purple: isDark ? `${theme.purple}22` : `${theme.purple}12`,
  };
  const borderMap: Record<HomeInsightTone, string> = {
    neutral: isDark ? theme.border : '#E8E6E0',
    success: isDark ? `${theme.success}44` : `${theme.success}33`,
    warning: isDark ? `${theme.accent3}44` : `${theme.accent3}33`,
    info: isDark ? `${theme.accent2}44` : `${theme.accent2}33`,
    danger: isDark ? `${theme.danger}44` : `${theme.danger}30`,
    purple: isDark ? `${theme.purple}44` : `${theme.purple}30`,
  };
  return { backgroundColor: map[tone], borderColor: borderMap[tone] };
}

export function HomeInsightBanner({
  kind,
  title,
  subtitle,
  tone = 'neutral',
  highlight,
  highlightLabel,
  trailingImageUri,
  pollBars,
  onPress,
}: {
  kind: HomeInsightKind;
  title: string;
  subtitle: string;
  tone?: HomeInsightTone;
  highlight?: string | null;
  highlightLabel?: string | null;
  trailingImageUri?: string | null;
  pollBars?: HomeInsightPollBar[] | null;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);
  const totalVotes = (pollBars ?? []).reduce((sum, bar) => sum + bar.votes, 0);
  const showPoll = (pollBars?.length ?? 0) > 0;
  const showTrailingImage = Boolean(trailingImageUri) && !showPoll;

  const body = (
    <View style={[styles.card, surfaceSubtleShadow(theme), colors]}>
      <Image source={ILLUSTRATIONS[kind]} style={styles.illustration} resizeMode="cover" />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: theme.text, fontFamily: theme.sansFamily }]}>{title}</Text>
        <Text
          style={[styles.subtitle, { color: theme.textMuted, fontFamily: theme.sansFamily }]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
        {highlight ? (
          <View style={styles.highlightRow}>
            {highlightLabel ? (
              <Text style={[styles.highlightLabel, { color: theme.textSubtle }]}>{highlightLabel}</Text>
            ) : null}
            <Text style={[styles.highlightValue, { color: theme.text }]}>{highlight}</Text>
          </View>
        ) : null}
      </View>
      {showTrailingImage ? (
        <Image source={{ uri: trailingImageUri! }} style={styles.trailingImage} resizeMode="cover" />
      ) : null}
      {showPoll ? (
        <View style={styles.pollMini}>
          {(pollBars ?? []).slice(0, 3).map((bar) => {
            const pct = totalVotes > 0 ? Math.round((bar.votes / totalVotes) * 100) : 0;
            return (
              <View key={bar.label} style={styles.pollRow}>
                <Text style={[styles.pollLabel, { color: theme.textMuted }]} numberOfLines={1}>
                  {bar.label}
                </Text>
                <View style={[styles.pollTrack, { backgroundColor: theme.mode === 'dark' ? '#334155' : '#E8E6E0' }]}>
                  <View
                    style={[
                      styles.pollFill,
                      {
                        width: `${Math.max(pct > 0 ? 8 : 0, pct)}%`,
                        backgroundColor: theme.purple,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.pollPct, { color: theme.text }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  if (!onPress) {
    return <View style={styles.wrap}>{body}</View>;
  }

  return (
    <PressableScale onPress={onPress} style={styles.wrap} accessibilityRole="button">
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: SURFACE_RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  illustration: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  highlightRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  highlightValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  trailingImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#E8E6E0',
  },
  pollMini: {
    width: 88,
    gap: 6,
  },
  pollRow: {
    gap: 2,
  },
  pollLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  pollTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pollFill: {
    height: '100%',
    borderRadius: 999,
  },
  pollPct: {
    fontSize: 9,
    fontWeight: '700',
  },
});
