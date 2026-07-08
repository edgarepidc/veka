import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  expenseCategoryLabel,
  expenseStatusLabel,
  formatCurrency,
  fundTypeLabel,
} from '@veka/shared';

import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/Avatar';
import { FilterBar } from '@/components/ui/TabStrip';
import { Tag } from '@/components/ui/Tag';
import type { CondoExpenseGroup, CondoFund } from '@/hooks/useFinance';
import { useTheme } from '@/hooks/useTheme';

interface CondoTransparencyTabProps {
  condominiumName: string;
  clusterName: string | null;
  unitIdentifier: string;
  funds: CondoFund[];
  expenseGroups: CondoExpenseGroup[];
  monthExpenseTotal: number;
  clusters: { id: string; name: string }[];
}

export function CondoTransparencyTab({
  condominiumName,
  clusterName,
  unitIdentifier,
  funds,
  expenseGroups,
  monthExpenseTotal,
  clusters,
}: CondoTransparencyTabProps) {
  const theme = useTheme();
  const myClusterId = clusters.find((c) => c.name === clusterName)?.id ?? null;
  const [clusterFilter, setClusterFilter] = useState<string>(myClusterId ?? 'all');

  const filterItems = useMemo(() => {
    const items = [{ key: 'all', label: 'Todo' }];
    if (myClusterId && clusterName) {
      items.push({ key: myClusterId, label: `Mi edificio (${clusterName})` });
    }
    for (const cluster of clusters) {
      if (cluster.id !== myClusterId) {
        items.push({ key: cluster.id, label: cluster.name });
      }
    }
    items.push({ key: 'general', label: 'General' });
    return items;
  }, [clusterName, clusters, myClusterId]);

  const filteredGroups = useMemo(() => {
    if (clusterFilter === 'all') return expenseGroups;
    if (clusterFilter === 'general') {
      return expenseGroups.filter((group) => group.clusterId === null);
    }
    return expenseGroups.filter((group) => group.clusterId === clusterFilter);
  }, [clusterFilter, expenseGroups]);

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
            Resumen de fondos y egresos del condominio. No incluye datos de otras unidades ni nómina detallada.
          </Text>
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

      <SectionLabel title="Egresos del mes" />
      <View style={styles.section}>
        <GlassCard>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 22 }}>
            {formatCurrency(monthExpenseTotal)}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>Comprobados / pagados este mes</Text>
        </GlassCard>
      </View>

      <SectionLabel title="Egresos por edificio" />
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
              {group.expenses.slice(0, 6).map((expense) => (
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
              {group.expenses.length > 6 ? (
                <Text style={{ color: theme.textSubtle, fontSize: 11, marginTop: 6 }}>
                  +{group.expenses.length - 6} egresos más en este grupo
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
