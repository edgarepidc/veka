import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  expenseCategoryLabel,
  expenseStatusLabel,
  formatCurrency,
  fundTypeLabel,
} from '@veka/shared';

import { FinancePeriodFilter } from '@/components/finance/FinanceCharts';
import { CondoTransparencySummary } from '@/components/finance/CondoStatsViews';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/Avatar';
import { FilterBar } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import type { CondoExpense, CondoExpenseGroup, CondoFund } from '@/hooks/useFinance';
import { useTheme } from '@/hooks/useTheme';
import { expenseAccentTone } from '@/lib/finance-accent';
import { inFinancePeriod, type FinancePeriod } from '@/lib/finance-period';
import {
  condoBudgetExecution,
  condoCollectionStats,
  condoExpensePeriodStats,
  condoIncomeDetailRows,
  condoIncomePeriodStats,
  condoMonthlyTrend,
  condoPeriodBalance,
  condoPeriodComparisons,
  expenseCategoryBreakdown,
  incomeRowCategoryLabel,
  matchesCondoClusterFilter,
  selectOperatingBudgetLines,
  type CondoCollectionFlowRow,
  type CondoIncomeRow,
  type CondoOperatingBudget,
} from '@/lib/finance-stats';

interface CondoTransparencyTabProps {
  condominiumName: string;
  clusterName: string | null;
  myClusterId: string | null;
  unitIdentifier: string;
  funds: CondoFund[];
  visibleExpenses: CondoExpense[];
  condoIncomeRows: CondoIncomeRow[];
  collectionFlowRows: CondoCollectionFlowRow[];
  operatingBudgets: CondoOperatingBudget[];
  expenseGroups: CondoExpenseGroup[];
}

export function CondoTransparencyTab({
  condominiumName,
  clusterName,
  myClusterId,
  unitIdentifier,
  funds,
  visibleExpenses,
  condoIncomeRows,
  collectionFlowRows,
  operatingBudgets,
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

  const scopedExpenses = useMemo(
    () =>
      visibleExpenses.filter((expense) =>
        matchesCondoClusterFilter(expense.cluster_id, clusterFilter, myClusterId),
      ),
    [clusterFilter, myClusterId, visibleExpenses],
  );

  const scopedIncomeRows = useMemo(
    () =>
      condoIncomeRows.filter((row) =>
        matchesCondoClusterFilter(row.cluster_id, clusterFilter, myClusterId),
      ),
    [clusterFilter, condoIncomeRows, myClusterId],
  );

  const incomeStats = useMemo(
    () => condoIncomePeriodStats(scopedIncomeRows, period),
    [scopedIncomeRows, period],
  );

  const expenseStats = useMemo(
    () => condoExpensePeriodStats(scopedExpenses, period),
    [scopedExpenses, period],
  );

  const categorySlices = useMemo(
    () => expenseCategoryBreakdown(scopedExpenses, period),
    [scopedExpenses, period],
  );

  const periodBalance = useMemo(
    () => condoPeriodBalance(incomeStats.total, expenseStats.paid, expenseStats.pending),
    [expenseStats.paid, expenseStats.pending, incomeStats.total],
  );

  const collection = useMemo(
    () => condoCollectionStats(collectionFlowRows, period, clusterFilter, myClusterId),
    [clusterFilter, collectionFlowRows, myClusterId, period],
  );

  const activeBudgetLines = useMemo(
    () => selectOperatingBudgetLines(operatingBudgets, clusterFilter),
    [clusterFilter, operatingBudgets],
  );

  const budget = useMemo(
    () => condoBudgetExecution(activeBudgetLines, scopedExpenses, period),
    [activeBudgetLines, period, scopedExpenses],
  );

  const incomeDetails = useMemo(
    () => condoIncomeDetailRows(condoIncomeRows, period, clusterFilter, myClusterId),
    [clusterFilter, condoIncomeRows, myClusterId, period],
  );

  const monthlyTrend = useMemo(
    () => condoMonthlyTrend(condoIncomeRows, visibleExpenses, clusterFilter, myClusterId),
    [clusterFilter, condoIncomeRows, myClusterId, visibleExpenses],
  );

  const comparisons = useMemo(
    () => condoPeriodComparisons(condoIncomeRows, visibleExpenses, period, clusterFilter, myClusterId),
    [clusterFilter, condoIncomeRows, myClusterId, period, visibleExpenses],
  );

  const showCollection = Boolean(myClusterId) && clusterFilter !== 'general';
  const collectionLabel = clusterName ?? 'Mi edificio';

  const filteredGroups = useMemo(() => {
    const groups = expenseGroups
      .map((group) => ({
        ...group,
        expenses: group.expenses.filter(
          (expense) =>
            inFinancePeriod(expense.expense_date, period) &&
            matchesCondoClusterFilter(expense.cluster_id, clusterFilter, myClusterId),
        ),
      }))
      .filter((group) => group.expenses.length > 0)
      .map((group) => ({
        ...group,
        totalAmount: group.expenses.reduce((sum, expense) => sum + expense.amount, 0),
      }));

    return groups;
  }, [clusterFilter, expenseGroups, myClusterId, period]);

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
            Ves ingresos y egresos del condominio general y de tu edificio. No incluye adeudos de otras unidades ni
            nómina detallada.
          </Text>
        </GlassCard>
      </View>

      <View style={styles.section}>
        <FilterBar items={filterItems} active={clusterFilter} onChange={setClusterFilter} />
        <View style={{ marginTop: 10 }}>
          <FinancePeriodFilter period={period} onChange={setPeriod} />
        </View>
        <CondoTransparencySummary
          income={incomeStats}
          expenses={expenseStats}
          categorySlices={categorySlices}
          totalFunds={totalFunds}
          period={period}
          periodBalance={periodBalance}
          collection={collection}
          showCollection={showCollection}
          collectionLabel={collectionLabel}
          budget={budget}
          monthlyTrend={monthlyTrend}
          comparisons={comparisons}
        />
      </View>

      <SectionLabel title="Detalle de ingresos" />
      <View style={styles.section}>
        {incomeDetails.length === 0 ? (
          <GlassCard variant="muted">
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>Sin ingresos en este filtro.</Text>
          </GlassCard>
        ) : (
          incomeDetails.map((row) => (
            <GlassCard
              key={`${row.source}-${row.id ?? row.income_date}-${row.amount}-${row.concept}`}
              variant="accent"
              accent={row.source === 'payment' ? 'green' : 'blue'}
              style={styles.cardGap}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{row.concept}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                    {incomeRowCategoryLabel(row)} · {row.income_date}
                  </Text>
                </View>
                <Text style={{ color: theme.success, fontWeight: '700', fontSize: 15 }}>
                  {formatCurrency(row.amount)}
                </Text>
              </View>
            </GlassCard>
          ))
        )}
      </View>

      {funds.length > 0 ? (
        <>
          <SectionLabel title="Desglose por fondo" />
          <View style={styles.section}>
            <GlassCard variant="muted">
              {funds.map((fund) => (
                <View key={fund.fund_type} style={styles.fundRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                      {fundTypeLabel(fund.fund_type as 'operating' | 'reserve')}
                    </Text>
                    <Text style={{ color: theme.textSubtle, fontSize: 11 }}>Al {fund.as_of_date}</Text>
                  </View>
                  <Text
                    style={{
                      color: fund.balance < 0 ? theme.danger : theme.accent2,
                      fontWeight: '700',
                      fontSize: 16,
                    }}
                  >
                    {formatCurrency(fund.balance)}
                  </Text>
                </View>
              ))}
            </GlassCard>
          </View>
        </>
      ) : null}

      <SectionLabel title="Detalle de egresos" />
      <View style={styles.section}>
        {filteredGroups.length === 0 ? (
          <GlassCard>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>No hay egresos en este filtro.</Text>
          </GlassCard>
        ) : (
          filteredGroups.flatMap((group) => [
            <View key={`${group.clusterId ?? 'general'}-header`} style={styles.groupHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{group.clusterName}</Text>
              <Text style={{ color: theme.accent2, fontWeight: '700', fontSize: 14 }}>
                {formatCurrency(group.totalAmount)}
              </Text>
            </View>,
            ...group.expenses.slice(0, 8).map((expense) => (
              <GlassCard
                key={expense.id}
                variant="accent"
                accent={expenseAccentTone(expense.status)}
                style={styles.cardGap}
              >
                <View style={styles.expenseRowInner}>
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
              </GlassCard>
            )),
            group.expenses.length > 8 ? (
              <Text
                key={`${group.clusterId ?? 'general'}-more`}
                style={{ color: theme.textSubtle, fontSize: 11, marginBottom: 12, paddingHorizontal: 4 }}
              >
                +{group.expenses.length - 8} egresos más en {group.clusterName}
              </Text>
            ) : null,
          ])
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
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  expenseRowInner: {
    flexDirection: 'row',
    gap: 12,
  },
});
