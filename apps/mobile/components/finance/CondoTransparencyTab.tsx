import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  expenseCategoryLabel,
  expenseStatusLabel,
  formatCurrency,
  fundTypeLabel,
} from '@veka/shared';

import {
  FinanceCompareChart,
  FinancePeriodFilter,
} from '@/components/finance/FinanceCharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/Avatar';
import { FilterBar } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import type { CondoExpense, CondoExpenseGroup, CondoFund } from '@/hooks/useFinance';
import { useTheme } from '@/hooks/useTheme';
import { financePeriodLabel, inFinancePeriod, type FinancePeriod } from '@/lib/finance-period';
import { condoPeriodStats } from '@/lib/finance-stats';

interface CondoTransparencyTabProps {
  condominiumName: string;
  clusterName: string | null;
  myClusterId: string | null;
  unitIdentifier: string;
  funds: CondoFund[];
  visibleExpenses: CondoExpense[];
  expenseGroups: CondoExpenseGroup[];
}

export function CondoTransparencyTab({
  condominiumName,
  clusterName,
  myClusterId,
  unitIdentifier,
  funds,
  visibleExpenses,
  expenseGroups,
}: CondoTransparencyTabProps) {
  const theme = useTheme();
  const [period, setPeriod] = useState<FinancePeriod>('1m');
  const [clusterFilter, setClusterFilter] = useState<string>('all');

  const filterItems = useMemo(() => {
    const items = [{ key: 'all', label: 'Todo lo visible' }];
    items.push({ key: 'general', label: 'General' });
    if (myClusterId && clusterName) {
      items.push({ key: myClusterId, label: `Mi edificio (${clusterName})` });
    }
    return items;
  }, [clusterName, myClusterId]);

  const periodStats = useMemo(
    () =>
      condoPeriodStats(visibleExpenses, period, myClusterId, {
        paid: theme.accent,
        pending: theme.accent3,
        general: theme.accent2,
        building: theme.accent,
      }),
    [visibleExpenses, period, myClusterId, theme.accent, theme.accent2, theme.accent3],
  );

  const filteredGroups = useMemo(() => {
    const groups = expenseGroups
      .map((group) => ({
        ...group,
        expenses: group.expenses.filter((expense) => inFinancePeriod(expense.expense_date, period)),
      }))
      .filter((group) => group.expenses.length > 0)
      .map((group) => ({
        ...group,
        totalAmount: group.expenses.reduce((sum, expense) => sum + expense.amount, 0),
      }));

    if (clusterFilter === 'all') return groups;
    if (clusterFilter === 'general') {
      return groups.filter((group) => group.clusterId === null);
    }
    return groups.filter((group) => group.clusterId === clusterFilter);
  }, [clusterFilter, expenseGroups, period]);

  const totalFunds = funds.reduce((sum, fund) => sum + fund.balance, 0);

  return (
    <>
      <View style={styles.section}>
        <GlassCard variant="muted">
          <Text style={[styles.cardLabel, { color: theme.textSubtle }]}>TRANSPARENCIA</Text>
          <Text style={[styles.cardTitle, { color: theme.text, marginTop: 6 }]}>{condominiumName}</Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>
            {clusterName ? `Tu edificio: ${clusterName} · Unidad ${unitIdentifier}` : `Unidad ${unitIdentifier}`}
          </Text>
          <Text style={{ color: theme.textSubtle, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
            Solo ves egresos del condominio general y de tu edificio. No incluye adeudos de otras unidades ni
            nómina detallada.
          </Text>
        </GlassCard>
      </View>

      <View style={styles.section}>
        <FinancePeriodFilter period={period} onChange={setPeriod} />
        <GlassCard>
          <FinanceCompareChart title={`Egresos · ${financePeriodLabel(period)}`} items={periodStats.compare} />
          <View style={{ height: 18 }} />
          <FinanceCompareChart title="Por alcance" items={periodStats.scopeCompare} />
        </GlassCard>
      </View>

      <SectionLabel title="Fondos del condominio" />
      <View style={styles.section}>
        <GlassCard>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 10 }}>
            Saldo consolidado:{' '}
            <Text style={{ color: theme.accent, fontWeight: '700' }}>{formatCurrency(totalFunds)}</Text>
          </Text>
          {funds.length === 0 ? (
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>Sin saldos registrados.</Text>
          ) : (
            funds.map((fund) => (
              <View key={fund.fund_type} style={styles.fundRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                    {fundTypeLabel(fund.fund_type as 'operating' | 'reserve')}
                  </Text>
                  <Text style={{ color: theme.textSubtle, fontSize: 11 }}>Al {fund.as_of_date}</Text>
                </View>
                <Text style={{ color: theme.accent2, fontWeight: '700', fontSize: 16 }}>
                  {formatCurrency(fund.balance)}
                </Text>
              </View>
            ))
          )}
        </GlassCard>
      </View>

      <SectionLabel title="Egresos del período" />
      <View style={styles.section}>
        <GlassCard>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 22 }}>
            {formatCurrency(periodStats.periodPaidTotal)}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>
            Comprobados / pagados · {financePeriodLabel(period).toLowerCase()}
          </Text>
        </GlassCard>
      </View>

      <SectionLabel title="Detalle por edificio" />
      <View style={styles.section}>
        <FilterBar items={filterItems} active={clusterFilter} onChange={setClusterFilter} />
        {filteredGroups.length === 0 ? (
          <GlassCard>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>No hay egresos en este filtro.</Text>
          </GlassCard>
        ) : (
          filteredGroups.map((group) => (
            <GlassCard key={group.clusterId ?? 'general'} style={styles.cardGap}>
              <View style={styles.cardTop}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{group.clusterName}</Text>
                <Text style={{ color: theme.accent2, fontWeight: '700', fontSize: 14 }}>
                  {formatCurrency(group.totalAmount)}
                </Text>
              </View>
              {group.expenses.slice(0, 8).map((expense) => (
                <View key={expense.id} style={styles.expenseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{expense.concept}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                      {expenseCategoryLabel(expense.category)} · {expense.expense_date}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
                      {formatCurrency(expense.amount)}
                    </Text>
                    <Tag
                      label={expenseStatusLabel(expense.status as 'pending' | 'paid')}
                      tone={expense.status === 'paid' ? 'green' : 'orange'}
                    />
                  </View>
                </View>
              ))}
              {group.expenses.length > 8 ? (
                <Text style={{ color: theme.textSubtle, fontSize: 11, marginTop: 6 }}>
                  +{group.expenses.length - 8} egresos más en este grupo
                </Text>
              ) : null}
            </GlassCard>
          ))
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 8 },
  cardGap: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  fundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  expenseRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
});
