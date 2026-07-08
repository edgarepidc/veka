import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  chargeBalanceDue,
  chargeDisplaySubtitle,
  chargeDisplayTitle,
  chargeKindLabel,
  chargeStatusLabel,
  chargeStatusTone,
  formatCurrency,
  installmentBalanceDue,
  installmentStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  planInstallmentsProgress,
  type PaymentTarget,
} from '@veka/shared';
import type { ActivePaymentPlan } from '@veka/shared';

import { OnlinePaymentButton } from '@/components/OnlinePaymentButton';
import { PaymentProofUploader } from '@/components/PaymentProofUploader';
import { FinancePeriodFilter } from '@/components/finance/FinanceCharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatPill } from '@/components/ui/StatPill';
import { GlassInput } from '@/components/ui/GlassInput';
import { SectionLabel } from '@/components/ui/Avatar';
import { Tag } from '@/components/ui/Tag';
import type { ActiveMembership } from '@/hooks/useMembership';
import type { FinanceCharge, FinancePayment } from '@/hooks/useFinance';
import { useTheme } from '@/hooks/useTheme';
import { inFinancePeriod, type FinancePeriod } from '@/lib/finance-period';
import { mapChargeTone, mapPaymentTone } from '@/lib/tagTone';
import { supabase } from '@/lib/supabase';

interface PersonalAccountTabProps {
  primary: ActiveMembership;
  charges: FinanceCharge[];
  payments: FinancePayment[];
  activePlan: ActivePaymentPlan | null;
  paymentTarget: PaymentTarget | null;
  balanceDue: number;
  statement: ReturnType<typeof import('@veka/shared').buildUnitStatementWithBalance>;
  bankAccounts: { id: string; name: string; bank_name: string | null; clabe: string | null; account_last4: string | null }[];
  payAmountInput: string;
  onPayAmountChange: (value: string) => void;
  onRefresh: () => void;
}

async function openPaymentProof(path: string): Promise<void> {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    await Linking.openURL(path);
    return;
  }
  const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 3600);
  if (data?.signedUrl) {
    await Linking.openURL(data.signedUrl);
  } else {
    Alert.alert('Comprobante', 'No se pudo abrir el archivo.');
  }
}

export function PersonalAccountTab({
  primary,
  charges,
  payments,
  activePlan,
  paymentTarget,
  balanceDue,
  statement,
  bankAccounts,
  payAmountInput,
  onPayAmountChange,
  onRefresh,
}: PersonalAccountTabProps) {
  const theme = useTheme();
  const [period, setPeriod] = useState<FinancePeriod>('1m');
  const paymentTotal = paymentTarget?.maxAmount ?? 0;
  const payAmount = Number(payAmountInput.replace(/,/g, ''));
  const planProgress = activePlan ? planInstallmentsProgress(activePlan.installments) : null;

  const filteredCharges = useMemo(
    () => charges.filter((charge) => inFinancePeriod(charge.due_date, period)),
    [charges, period],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => inFinancePeriod(payment.paid_at ?? payment.created_at, period)),
    [payments, period],
  );

  const filteredStatementLines = useMemo(
    () => statement.lines.filter((line) => inFinancePeriod(line.date, period)),
    [statement.lines, period],
  );

  const openProof = useCallback((path: string | null) => {
    if (!path) return;
    void openPaymentProof(path);
  }, []);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
        <StatPill
          label="Próximo pago"
          value={paymentTarget ? formatCurrency(paymentTotal) : '—'}
          sub={paymentTarget ? `Vence ${paymentTarget.dueDate}` : 'Al día'}
          valueColor={paymentTarget?.kind === 'installment' ? theme.accent2 : theme.accent}
        />
        <StatPill
          label="Saldo total"
          value={formatCurrency(balanceDue)}
          sub={balanceDue > 0 ? 'pendiente' : 'al corriente'}
          valueColor={balanceDue > 0 ? theme.danger : theme.accent}
        />
        <StatPill
          label="En revisión"
          value={String(
            payments.filter((p) =>
              ['pending_review', 'pending_second_review', 'awaiting_payment'].includes(p.status),
            ).length,
          )}
          sub="pagos"
          valueColor={theme.accent3}
        />
      </ScrollView>

      {activePlan ? (
        <View style={styles.section}>
          <GlassCard>
            <Text style={[styles.cardLabel, { color: theme.textSubtle }]}>PLAN DE PAGO ACTIVO</Text>
            <Text style={[styles.cardTitle, { color: theme.text, marginTop: 6 }]}>{activePlan.title}</Text>
            {planProgress ? (
              <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>
                {planProgress.paidCount} de {planProgress.totalCount} parcialidades
                {planProgress.percent !== null ? ` · ${planProgress.percent}%` : ''}
              </Text>
            ) : null}
            {[...activePlan.installments]
              .sort((a, b) => a.installment_number - b.installment_number)
              .map((installment) => {
                const balance = installmentBalanceDue(installment);
                return (
                  <View key={installment.id} style={styles.ledgerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                        Parcialidad {installment.installment_number}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12 }}>Vence {installment.due_date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>
                        {formatCurrency(balance > 0 ? balance : Number(installment.amount))}
                      </Text>
                      <Text style={{ color: theme.textSubtle, fontSize: 11 }}>
                        {installmentStatusLabel(installment.status)}
                      </Text>
                    </View>
                  </View>
                );
              })}
          </GlassCard>
        </View>
      ) : null}

      {paymentTarget ? (
        <View style={styles.section}>
          <GlassCard variant="accent" accent="blue">
            <View style={styles.cardTop}>
              <Text style={[styles.cardLabel, { color: theme.textSubtle }]}>
                {paymentTarget.kind === 'installment' ? 'PRÓXIMA PARCIALIDAD' : 'PAGAR'}
              </Text>
              {paymentTarget.kind === 'charges' ? (
                <Tag
                  label={chargeStatusLabel(
                    charges.find((c) => c.id === paymentTarget.chargeId)?.status ?? 'pending',
                  )}
                  tone={mapChargeTone(
                    chargeStatusTone(charges.find((c) => c.id === paymentTarget.chargeId)?.status ?? 'pending'),
                  )}
                />
              ) : null}
            </View>
            <Text style={[styles.amount, { color: theme.accent, fontFamily: theme.serifFamily }]}>
              {formatCurrency(paymentTotal)}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
              {paymentTarget.label} · Vence {paymentTarget.dueDate}
            </Text>

            {bankAccounts.length > 0 ? (
              <View style={[styles.bankBox, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.cardLabel, { color: theme.textSubtle, marginBottom: 8 }]}>
                  DATOS PARA TRANSFERENCIA
                </Text>
                {bankAccounts.map((account) => (
                  <View key={account.id} style={{ marginBottom: 8 }}>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{account.name}</Text>
                    {account.bank_name ? (
                      <Text style={{ color: theme.textMuted, fontSize: 12 }}>{account.bank_name}</Text>
                    ) : null}
                    {account.clabe ? (
                      <Text style={{ color: theme.accent2, fontSize: 12, marginTop: 2 }}>
                        CLABE {account.clabe}
                      </Text>
                    ) : null}
                    {account.account_last4 ? (
                      <Text style={{ color: theme.textSubtle, fontSize: 11 }}>
                        Cuenta ····{account.account_last4}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={{ color: theme.textSubtle, fontSize: 12, marginBottom: 6, marginTop: 8 }}>
              Monto a pagar (abono parcial permitido)
            </Text>
            <GlassInput
              value={payAmountInput}
              onChangeText={onPayAmountChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
              style={{ marginBottom: 8 }}
            />
            <Text style={{ color: theme.textSubtle, fontSize: 11, marginBottom: 12 }}>
              Máximo {formatCurrency(paymentTotal)}
            </Text>
            <PaymentProofUploader
              chargeId={paymentTarget.chargeId}
              installmentId={paymentTarget.installmentId}
              condominiumId={primary.condominium_id}
              unitId={primary.unit_id!}
              amount={payAmount}
              maxAmount={paymentTotal}
              onUploaded={onRefresh}
            />
            <View style={{ height: 10 }} />
            <OnlinePaymentButton
              chargeId={paymentTarget.chargeId}
              installmentId={paymentTarget.installmentId}
              amount={payAmount}
              maxAmount={paymentTotal}
              disabled={!Number.isFinite(payAmount) || payAmount <= 0}
              onStarted={onRefresh}
            />
          </GlassCard>
        </View>
      ) : (
        <View style={styles.section}>
          <GlassCard variant="accent" accent="green">
            <Text style={[styles.cardTitle, { color: theme.text }]}>Estás al corriente</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>
              No tienes cargos pendientes por pagar.
            </Text>
          </GlassCard>
        </View>
      )}

      <View style={styles.section}>
        <FinancePeriodFilter period={period} onChange={setPeriod} />
      </View>

      <SectionLabel title="Mi estado de cuenta" />
      <View style={styles.section}>
        <GlassCard>
          {filteredStatementLines.length === 0 ? (
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>Sin movimientos en este período.</Text>
          ) : (
            filteredStatementLines.map((line) => (
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
        {filteredCharges.length === 0 ? (
          <GlassCard>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>Sin cargos en este período.</Text>
          </GlassCard>
        ) : (
        filteredCharges.map((charge) => {
          const balance = chargeBalanceDue(charge);
          const paid = charge.amount - balance;
          return (
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
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
                {balance > 0 ? formatCurrency(balance) : formatCurrency(charge.amount)}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                Vence {charge.due_date}
                {paid > 0 && balance > 0 ? ` · Abonado ${formatCurrency(paid)}` : ''}
                {paid > 0 && balance > 0 ? ` · de ${formatCurrency(charge.amount)}` : ''}
              </Text>
            </GlassCard>
          );
        })
        )}
      </View>

      <SectionLabel title="Mis pagos" />
      <View style={styles.section}>
        {filteredPayments.length === 0 ? (
          <GlassCard>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>Sin pagos en este período.</Text>
          </GlassCard>
        ) : (
          filteredPayments.map((payment) => (
            <GlassCard key={payment.id} style={styles.cardGap}>
              <View style={styles.cardTop}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {formatCurrency(payment.amount)}
                </Text>
                <Tag
                  label={paymentStatusLabel(payment.status)}
                  tone={mapPaymentTone(paymentStatusTone(payment.status))}
                />
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                {new Date(payment.created_at).toLocaleDateString('es-MX')} ·{' '}
                {paymentMethodLabel(payment.payment_method)}
              </Text>
              {payment.status === 'awaiting_payment' && payment.gateway_reference ? (
                <Text style={{ color: theme.accent2, fontSize: 12, marginTop: 6, fontWeight: '600' }}>
                  Referencia: {payment.gateway_reference}
                </Text>
              ) : null}
              {payment.status === 'rejected' && payment.rejection_reason ? (
                <Text style={{ color: theme.danger, fontSize: 12, marginTop: 6 }}>
                  Motivo: {payment.rejection_reason}
                </Text>
              ) : null}
              {payment.status === 'pending_second_review' ? (
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>
                  Requiere segunda aprobación de administración.
                </Text>
              ) : null}
              {payment.proof_url ? (
                <Pressable onPress={() => void openProof(payment.proof_url)} style={{ marginTop: 8 }}>
                  <Text style={{ color: theme.accent2, fontSize: 12, fontWeight: '600' }}>Ver comprobante</Text>
                </Pressable>
              ) : null}
            </GlassCard>
          ))
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: { gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  cardGap: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  amount: { fontSize: 32, fontWeight: '700', marginVertical: 8 },
  ledgerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  bankBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 4 },
  section: { paddingHorizontal: 20, marginBottom: 8 },
});
