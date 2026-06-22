import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildNextPaymentGroup,
  buildUnitStatementWithBalance,
  chargeDisplaySubtitle,
  chargeDisplayTitle,
  chargeKindLabel,
  chargeStatusLabel,
  chargeStatusTone,
  formatCurrency,
  paymentStatusLabel,
  unitBalanceDue,
} from '@veka/shared';
import type { FeeSourceRef } from '@veka/shared';

import { OnlinePaymentButton } from '@/components/OnlinePaymentButton';
import { PaymentProofUploader } from '@/components/PaymentProofUploader';
import { ScreenHeader, SectionLabel } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StatPill } from '@/components/ui/StatPill';
import { Tag } from '@/components/ui/Tag';
import { useMembership } from '@/hooks/useMembership';
import { useTheme } from '@/hooks/useTheme';
import { mapChargeTone } from '@/lib/tagTone';
import { supabase } from '@/lib/supabase';

interface ChargeRow {
  id: string;
  concept: string;
  amount: number;
  amount_paid?: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  fund_type: string;
  charge_kind?: string;
  parent_charge_id?: string | null;
  fee_campaign: FeeSourceRef | null;
  recurring_fee: FeeSourceRef | null;
}

function normalizeFeeSource(raw: unknown): FeeSourceRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as FeeSourceRef & { cluster?: { name: string } | { name: string }[] | null };
  const cluster = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
  return { ...row, cluster: cluster ?? null };
}

interface PaymentRow {
  id: string;
  charge_id: string;
  amount: number;
  status: 'pending_review' | 'approved' | 'rejected';
  created_at: string;
  paid_at: string | null;
}

interface FundBalance {
  fund_type: string;
  balance: number;
}

interface ExpenseRow {
  id: string;
  concept: string;
  amount: number;
  category: string;
  expense_date: string;
}

export default function FinanceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { primary, loading: membershipLoading } = useMembership();

  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [funds, setFunds] = useState<FundBalance[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id) {
      setLoading(false);
      return;
    }

    const [chargesRes, paymentsRes, fundsRes, expensesRes] = await Promise.all([
      supabase
        .from('charges')
        .select(
          'id, concept, amount, amount_paid, due_date, status, fund_type, charge_kind, parent_charge_id, fee_campaign:fee_campaigns(scope, concept, amount, cluster:clusters(name)), recurring_fee:recurring_fees(scope, concept, cluster:clusters(name))',
        )
        .eq('unit_id', primary.unit_id)
        .order('due_date', { ascending: true }),
      supabase
        .from('payments')
        .select('id, charge_id, amount, status, created_at, paid_at')
        .eq('unit_id', primary.unit_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('fund_balances')
        .select('fund_type, balance')
        .eq('condominium_id', primary.condominium_id),
      supabase
        .from('expenses')
        .select('id, concept, amount, category, expense_date')
        .eq('condominium_id', primary.condominium_id)
        .order('expense_date', { ascending: false })
        .limit(5),
    ]);

    setCharges(
      ((chargesRes.data as Omit<ChargeRow, 'fee_campaign' | 'recurring_fee'>[] | null) ?? []).map(
        (charge) => ({
          ...charge,
          amount: Number(charge.amount),
          amount_paid: Number(charge.amount_paid ?? 0),
          fee_campaign: normalizeFeeSource(
            (charge as { fee_campaign?: unknown }).fee_campaign,
          ),
          recurring_fee: normalizeFeeSource(
            (charge as { recurring_fee?: unknown }).recurring_fee,
          ),
        }),
      ),
    );
    setPayments((paymentsRes.data as PaymentRow[]) ?? []);
    setFunds((fundsRes.data as FundBalance[]) ?? []);
    setExpenses((expensesRes.data as ExpenseRow[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [primary]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const statement = useMemo(
    () =>
      buildUnitStatementWithBalance(
        charges.map((charge) => ({
          id: charge.id,
          concept: charge.concept,
          amount: Number(charge.amount),
          amount_paid: Number(charge.amount_paid ?? 0),
          due_date: charge.due_date,
          status: charge.status,
        })),
        payments.map((payment) => ({
          id: payment.id,
          charge_id: payment.charge_id,
          amount: Number(payment.amount),
          status: payment.status,
          paid_at: payment.paid_at,
          created_at: payment.created_at,
        })),
      ),
    [charges, payments],
  );

  const balanceDue = useMemo(
    () =>
      unitBalanceDue(
        charges.map((charge) => ({
          id: charge.id,
          concept: charge.concept,
          amount: Number(charge.amount),
          amount_paid: Number(charge.amount_paid ?? 0),
          due_date: charge.due_date,
          status: charge.status,
        })),
      ),
    [charges],
  );

  const paymentGroup = useMemo(() => buildNextPaymentGroup(charges), [charges]);
  const nextCharge = paymentGroup?.primaryCharge ?? null;
  const paymentTotal = paymentGroup?.totalAmount ?? 0;
  const [payAmountInput, setPayAmountInput] = useState('');

  useEffect(() => {
    setPayAmountInput(paymentTotal > 0 ? String(paymentTotal) : '');
  }, [paymentTotal, nextCharge?.id]);

  const payAmount = useMemo(() => Number(payAmountInput.replace(/,/g, '')), [payAmountInput]);

  if (membershipLoading || loading) {
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

  const pendingPayments = payments.filter((p) => p.status === 'pending_review').length;

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Finanzas"
          highlight="personales"
          subtitle={`${primary.condominium?.name} · Unidad ${primary.unit?.identifier}`}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatPill
            label="Próximo pago"
            value={nextCharge ? formatCurrency(paymentTotal) : '—'}
            sub={nextCharge ? `Vence ${nextCharge.due_date}` : 'Al día'}
            valueColor={nextCharge?.status === 'overdue' ? theme.danger : theme.accent}
          />
          <StatPill
            label="Cargos"
            value={String(charges.length)}
            sub="registrados"
            valueColor={theme.accent2}
          />
          <StatPill
            label="Saldo pendiente"
            value={formatCurrency(balanceDue)}
            sub={balanceDue > 0 ? 'por pagar' : 'al corriente'}
            valueColor={balanceDue > 0 ? theme.danger : theme.accent}
          />
          <StatPill
            label="Pagos"
            value={String(pendingPayments)}
            sub="en revisión"
            valueColor={theme.accent3}
          />
        </ScrollView>

        {nextCharge ? (
          <View style={styles.section}>
            <GlassCard>
              <View style={styles.cardTop}>
                <Text style={[styles.cardLabel, { color: theme.textSubtle }]}>PRÓXIMO PAGO</Text>
                <Tag label={chargeStatusLabel(nextCharge.status)} tone={mapChargeTone(chargeStatusTone(nextCharge.status))} />
              </View>
              <Text style={[styles.amount, { color: theme.accent, fontFamily: theme.serifFamily }]}>
                {formatCurrency(paymentTotal)}
              </Text>
              {paymentGroup && paymentGroup.relatedCharges.length > 0 ? (
                <Text style={{ color: theme.danger, fontSize: 12, marginBottom: 8 }}>
                  Incluye {paymentGroup.relatedCharges.length} recargo(s) por mora
                </Text>
              ) : null}
              <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
                {chargeDisplayTitle(nextCharge)}
                {chargeDisplaySubtitle(nextCharge) ? ` · ${chargeDisplaySubtitle(nextCharge)}` : ''}
                {' · '}Vence {nextCharge.due_date}
              </Text>
              <Text style={{ color: theme.textSubtle, fontSize: 12, marginBottom: 6 }}>
                Monto a pagar (abono parcial permitido)
              </Text>
              <TextInput
                value={payAmountInput}
                onChangeText={setPayAmountInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textSubtle}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: theme.text,
                  backgroundColor: theme.card,
                  marginBottom: 8,
                }}
              />
              <Text style={{ color: theme.textSubtle, fontSize: 11, marginBottom: 12 }}>
                Máximo {formatCurrency(paymentTotal)}
              </Text>
              <PaymentProofUploader
                chargeId={nextCharge.id}
                condominiumId={primary.condominium_id}
                unitId={primary.unit_id}
                amount={payAmount}
                maxAmount={paymentTotal}
                onUploaded={loadData}
              />
              <View style={{ height: 10 }} />
              <OnlinePaymentButton
                chargeId={nextCharge.id}
                amount={payAmount}
                maxAmount={paymentTotal}
                disabled={!Number.isFinite(payAmount) || payAmount <= 0}
                onStarted={loadData}
              />
            </GlassCard>
          </View>
        ) : null}

        <SectionLabel title="Mi estado de cuenta" />
        <View style={styles.section}>
          <GlassCard>
            <Text style={[styles.cardLabel, { color: theme.textSubtle, marginBottom: 8 }]}>MOVIMIENTOS</Text>
            {statement.lines.length === 0 ? (
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>Sin movimientos registrados.</Text>
            ) : (
              statement.lines.map((line) => (
                <View key={line.id} style={styles.ledgerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text, fontSize: 14 }]}>{line.concept}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12 }}>{line.date}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {line.debit > 0 ? (
                      <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 13 }}>
                        +{formatCurrency(line.debit)}
                      </Text>
                    ) : null}
                    {line.credit > 0 ? (
                      <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>
                        −{formatCurrency(line.credit)}
                      </Text>
                    ) : null}
                    <Text style={{ color: theme.textSubtle, fontSize: 11, marginTop: 2 }}>
                      Saldo {formatCurrency(line.runningBalance)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </GlassCard>
        </View>

        <SectionLabel title="Mis cargos" />
        <View style={styles.section}>
          {charges.map((charge) => (
            <GlassCard key={charge.id} style={styles.cardGap}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{chargeDisplayTitle(charge)}</Text>
                  {charge.charge_kind === 'late_fee' ? (
                    <Text style={{ color: theme.danger, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                      {chargeKindLabel(charge.charge_kind)}
                    </Text>
                  ) : chargeDisplaySubtitle(charge) ? (
                    <Text style={{ color: theme.accent2, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                      {chargeDisplaySubtitle(charge)}
                    </Text>
                  ) : null}
                </View>
                <Tag label={chargeStatusLabel(charge.status)} tone={mapChargeTone(chargeStatusTone(charge.status))} />
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                Vence {charge.due_date} · {formatCurrency(Number(charge.amount))}
              </Text>
            </GlassCard>
          ))}
        </View>

        <SectionLabel title="Mis pagos" />
        <View style={styles.section}>
          {payments.length === 0 ? (
            <GlassCard>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>Aún no hay pagos registrados.</Text>
            </GlassCard>
          ) : (
            payments.map((payment) => (
              <GlassCard key={payment.id} style={styles.cardGap}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {formatCurrency(Number(payment.amount))}
                  </Text>
                  <Tag
                    label={paymentStatusLabel(payment.status)}
                    tone={
                      payment.status === 'approved'
                        ? 'green'
                        : payment.status === 'rejected'
                          ? 'red'
                          : 'orange'
                    }
                  />
                </View>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                  {new Date(payment.created_at).toLocaleDateString('es-MX')}
                </Text>
              </GlassCard>
            ))
          )}
        </View>

        <SectionLabel title="Estado del condominio" />
        <View style={styles.section}>
          {funds.map((fund) => (
            <GlassCard key={fund.fund_type} style={styles.cardGap}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {fund.fund_type === 'operating' ? 'Fondo operativo' : 'Fondo de reserva'}
              </Text>
              <Text style={[styles.fundAmount, { color: theme.accent2 }]}>
                {formatCurrency(Number(fund.balance))}
              </Text>
            </GlassCard>
          ))}
        </View>

        <SectionLabel title="Últimos egresos" />
        <View style={styles.section}>
          {expenses.map((expense) => (
            <GlassCard key={expense.id} style={styles.cardGap}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{expense.concept}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                {expense.category} · {expense.expense_date} · {formatCurrency(Number(expense.amount))}
              </Text>
            </GlassCard>
          ))}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {},
  statsRow: { gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  section: { paddingHorizontal: 20, marginBottom: 8 },
  cardGap: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  amount: { fontSize: 32, fontWeight: '700', marginVertical: 8 },
  fundAmount: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  ledgerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
});
