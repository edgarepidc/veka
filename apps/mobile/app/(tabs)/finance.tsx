import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CondoTransparencyTab } from '@/components/finance/CondoTransparencyTab';
import { PersonalAccountTab } from '@/components/finance/PersonalAccountTab';
import { ScreenHeader } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { TabStrip } from '@/components/ui/TabStrip';
import { useFinance } from '@/hooks/useFinance';
import { useMembership } from '@/hooks/useMembership';
import { useTheme } from '@/hooks/useTheme';

type FinanceTab = 'mi-cuenta' | 'condominio';

export default function FinanceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { primary, loading: membershipLoading } = useMembership();
  const finance = useFinance(primary);
  const [tab, setTab] = useState<FinanceTab>('mi-cuenta');
  const [payAmountInput, setPayAmountInput] = useState('');

  useEffect(() => {
    if (params.tab === 'mi-cuenta' || params.tab === 'condominio') {
      setTab(params.tab);
    }
  }, [params.tab]);

  useEffect(() => {
    const total = finance.paymentTarget?.maxAmount ?? 0;
    setPayAmountInput(total > 0 ? String(total) : '');
  }, [finance.paymentTarget?.maxAmount, finance.paymentTarget?.chargeId, finance.paymentTarget?.installmentId]);

  if (membershipLoading || finance.loading) {
    return (
      <ScreenBackground style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
      </ScreenBackground>
    );
  }

  if (!primary?.unit_id) {
    return (
      <ScreenBackground style={[styles.centered, { padding: 24 }]}>
        <GlassCard>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin unidad asignada</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Pide a la administración que te invite con tu correo electrónico.
          </Text>
        </GlassCard>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={finance.refreshing} onRefresh={() => void finance.refresh()} tintColor={theme.accent} />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Finanzas"
          highlight={tab === 'mi-cuenta' ? 'personales' : 'del condominio'}
          subtitle={`${primary.condominium?.name} · Unidad ${primary.unit?.identifier}`}
        />

        <View style={styles.section}>
          <TabStrip
            tabs={[
              { key: 'mi-cuenta', label: 'Mi cuenta' },
              { key: 'condominio', label: 'Condominio' },
            ]}
            active={tab}
            onChange={(key) => setTab(key as FinanceTab)}
          />
        </View>

        {finance.error ? (
          <View style={styles.section}>
            <GlassCard variant="accent" accent="danger">
              <Text style={{ color: theme.danger, fontSize: 13 }}>{finance.error}</Text>
            </GlassCard>
          </View>
        ) : null}

        {tab === 'mi-cuenta' ? (
          <PersonalAccountTab
            primary={primary}
            charges={finance.charges}
            payments={finance.payments}
            activePlan={finance.activePlan}
            paymentTarget={finance.paymentTarget}
            balanceDue={finance.balanceDue}
            statement={finance.statement}
            bankAccounts={finance.bankAccounts}
            payAmountInput={payAmountInput}
            onPayAmountChange={setPayAmountInput}
            onRefresh={() => void finance.refresh()}
          />
        ) : (
          <CondoTransparencyTab
            condominiumName={primary.condominium?.name ?? 'Condominio'}
            clusterName={primary.unit?.cluster?.name ?? null}
            myClusterId={primary.unit?.cluster?.id ?? null}
            unitIdentifier={primary.unit?.identifier ?? '—'}
            funds={finance.funds}
            visibleExpenses={finance.visibleExpenses}
            expenseGroups={finance.expenseGroups}
          />
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {},
  section: { paddingHorizontal: 20, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
});
