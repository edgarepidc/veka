import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  chargeStatusLabel,
  chargeStatusTone,
  formatCurrency,
  paymentStatusLabel,
} from '@veka/shared';

import { PaymentProofUploader } from '@/components/PaymentProofUploader';
import { SectionCard } from '@/components/SectionCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useMembership } from '@/hooks/useMembership';
import { supabase } from '@/lib/supabase';

interface ChargeRow {
  id: string;
  concept: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  fund_type: string;
}

interface PaymentRow {
  id: string;
  charge_id: string;
  amount: number;
  status: 'pending_review' | 'approved' | 'rejected';
  created_at: string;
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
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
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
        .select('id, concept, amount, due_date, status, fund_type')
        .eq('unit_id', primary.unit_id)
        .order('due_date', { ascending: false }),
      supabase
        .from('payments')
        .select('id, charge_id, amount, status, created_at')
        .eq('unit_id', primary.unit_id)
        .order('created_at', { ascending: false })
        .limit(10),
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

    setCharges((chargesRes.data as ChargeRow[]) ?? []);
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

  if (membershipLoading || loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!primary?.unit_id) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin unidad asignada</Text>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          Pide a la administración que te invite con tu correo electrónico.
        </Text>
      </View>
    );
  }

  const nextCharge = charges.find((c) => c.status === 'pending' || c.status === 'overdue');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Finanzas</Text>
      <Text style={[styles.subheading, { color: colors.muted }]}>
        {primary.condominium?.name} · Unidad {primary.unit?.identifier}
      </Text>

      {nextCharge ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Próximo pago</Text>
          <Text style={[styles.amount, { color: colors.primary }]}>
            {formatCurrency(Number(nextCharge.amount))}
          </Text>
          <Text style={{ color: colors.muted }}>
            {nextCharge.concept} · Vence {nextCharge.due_date}
          </Text>
          <View style={{ marginTop: 12 }}>
            <PaymentProofUploader
              chargeId={nextCharge.id}
              condominiumId={primary.condominium_id}
              unitId={primary.unit_id}
              amount={Number(nextCharge.amount)}
              onUploaded={loadData}
            />
          </View>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Mis cargos</Text>
      {charges.map((charge) => (
        <SectionCard
          key={charge.id}
          title={charge.concept}
          description={`Vence ${charge.due_date} · ${formatCurrency(Number(charge.amount))}`}
          badge={chargeStatusLabel(charge.status)}
          badgeTone={chargeStatusTone(charge.status)}
        />
      ))}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Mis pagos</Text>
      {payments.length === 0 ? (
        <Text style={{ color: colors.muted }}>Aún no hay pagos registrados.</Text>
      ) : (
        payments.map((payment) => (
          <SectionCard
            key={payment.id}
            title={formatCurrency(Number(payment.amount))}
            description={new Date(payment.created_at).toLocaleDateString('es-MX')}
            badge={paymentStatusLabel(payment.status)}
            badgeTone={
              payment.status === 'approved'
                ? 'success'
                : payment.status === 'rejected'
                  ? 'danger'
                  : 'warning'
            }
          />
        ))
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Estado del condominio</Text>
      {funds.map((fund) => (
        <SectionCard
          key={fund.fund_type}
          title={fund.fund_type === 'operating' ? 'Fondo operativo' : 'Fondo de reserva'}
          description={formatCurrency(Number(fund.balance))}
        />
      ))}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Últimos egresos</Text>
      {expenses.map((expense) => (
        <SectionCard
          key={expense.id}
          title={expense.concept}
          description={`${expense.category} · ${expense.expense_date} · ${formatCurrency(Number(expense.amount))}`}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '700' },
  subheading: { fontSize: 14, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  amount: { fontSize: 28, fontWeight: '700' },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
