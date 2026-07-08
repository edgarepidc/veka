import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildUnitStatementWithBalance,
  resolveNextPaymentTarget,
  unitTotalBalanceDue,
  type ActivePaymentPlan,
  type PaymentStatus,
} from '@veka/shared';
import type { FeeSourceRef } from '@veka/shared';

import type { ActiveMembership } from '@/hooks/useMembership';
import { filterVisibleCondoExpenses } from '@/lib/finance-stats';
import { supabase } from '@/lib/supabase';

export interface FinanceCharge {
  id: string;
  concept: string;
  amount: number;
  amount_paid: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'forgiven';
  fund_type: string;
  charge_kind?: string;
  parent_charge_id?: string | null;
  fee_campaign: FeeSourceRef | null;
  recurring_fee: FeeSourceRef | null;
}

export interface FinancePayment {
  id: string;
  charge_id: string;
  amount: number;
  status: PaymentStatus;
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
  proof_url: string | null;
  rejection_reason: string | null;
  gateway_reference: string | null;
}

export interface CondoFund {
  fund_type: string;
  balance: number;
  as_of_date: string;
}

export interface CondoExpense {
  id: string;
  concept: string;
  amount: number;
  category: string;
  expense_date: string;
  fund_type: string;
  expense_kind: string;
  status: string;
  cluster_id: string | null;
  cluster_name: string | null;
}

export interface CondoBankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  clabe: string | null;
  account_last4: string | null;
}

export interface CondoExpenseGroup {
  clusterId: string | null;
  clusterName: string;
  expenses: CondoExpense[];
  totalAmount: number;
}

function normalizeFeeSource(raw: unknown): FeeSourceRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as FeeSourceRef & { cluster?: { name: string } | { name: string }[] | null };
  const cluster = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
  return { ...row, cluster: cluster ?? null };
}

function groupExpenses(expenses: CondoExpense[]): CondoExpenseGroup[] {
  const map = new Map<string, CondoExpenseGroup>();

  for (const expense of expenses) {
    const key = expense.cluster_id ?? '__general__';
    const clusterName = expense.cluster_name ?? 'Condominio general';
    const existing = map.get(key);
    if (existing) {
      existing.expenses.push(expense);
      existing.totalAmount += expense.amount;
    } else {
      map.set(key, {
        clusterId: expense.cluster_id,
        clusterName,
        expenses: [expense],
        totalAmount: expense.amount,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.clusterId === null) return -1;
    if (b.clusterId === null) return 1;
    return a.clusterName.localeCompare(b.clusterName, 'es');
  });
}

export function useFinance(primary: ActiveMembership | null) {
  const [charges, setCharges] = useState<FinanceCharge[]>([]);
  const [activePlan, setActivePlan] = useState<ActivePaymentPlan | null>(null);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [funds, setFunds] = useState<CondoFund[]>([]);
  const [expenses, setExpenses] = useState<CondoExpense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CondoBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!primary?.condominium_id || !primary.unit_id) {
      setCharges([]);
      setActivePlan(null);
      setPayments([]);
      setFunds([]);
      setExpenses([]);
      setBankAccounts([]);
      setLoading(false);
      setError(null);
      return;
    }

    const [chargesRes, paymentsRes, fundsRes, expensesRes, planRes, banksRes] =
      await Promise.all([
        supabase
          .from('charges')
          .select(
            'id, concept, amount, amount_paid, due_date, status, fund_type, charge_kind, parent_charge_id, fee_campaign:fee_campaigns(scope, concept, amount, cluster:clusters(name)), recurring_fee:recurring_fees(scope, concept, cluster:clusters(name))',
          )
          .eq('unit_id', primary.unit_id)
          .order('due_date', { ascending: true }),
        supabase
          .from('payments')
          .select(
            'id, charge_id, amount, status, created_at, paid_at, payment_method, proof_url, rejection_reason, gateway_reference',
          )
          .eq('unit_id', primary.unit_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('fund_balances')
          .select('fund_type, balance, as_of_date')
          .eq('condominium_id', primary.condominium_id),
        supabase
          .from('expenses')
          .select(
            'id, concept, amount, category, expense_date, fund_type, expense_kind, status, cluster_id, cluster:clusters(name)',
          )
          .eq('condominium_id', primary.condominium_id)
          .order('expense_date', { ascending: false })
          .limit(200),
        supabase
          .from('payment_plans')
          .select(
            'id, title, status, total_amount, installments:payment_plan_installments(id, installment_number, due_date, amount, amount_paid, status), charge_links:payment_plan_charges(charge_id)',
          )
          .eq('unit_id', primary.unit_id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('bank_accounts')
          .select('id, name, bank_name, clabe, account_last4')
          .eq('condominium_id', primary.condominium_id)
          .eq('is_active', true)
          .order('name'),
      ]);

    const queryError =
      chargesRes.error ??
      paymentsRes.error ??
      fundsRes.error ??
      expensesRes.error ??
      planRes.error ??
      banksRes.error;

    if (queryError) {
      setError(queryError.message);
    } else {
      setError(null);
    }

    setCharges(
      ((chargesRes.data as Omit<FinanceCharge, 'fee_campaign' | 'recurring_fee'>[] | null) ?? []).map(
        (charge) => ({
          ...charge,
          amount: Number(charge.amount),
          amount_paid: Number(charge.amount_paid ?? 0),
          fee_campaign: normalizeFeeSource((charge as { fee_campaign?: unknown }).fee_campaign),
          recurring_fee: normalizeFeeSource((charge as { recurring_fee?: unknown }).recurring_fee),
        }),
      ),
    );

    const planRow = planRes.data as {
      id: string;
      title: string;
      status: string;
      total_amount: number;
      installments: ActivePaymentPlan['installments'];
      charge_links: { charge_id: string }[];
    } | null;

    setActivePlan(
      planRow
        ? {
            id: planRow.id,
            title: planRow.title,
            status: planRow.status,
            total_amount: Number(planRow.total_amount),
            installments: (planRow.installments ?? []).map((row) => ({
              ...row,
              amount: Number(row.amount),
              amount_paid: Number(row.amount_paid ?? 0),
            })),
            linked_charge_ids: (planRow.charge_links ?? []).map((link) => link.charge_id),
          }
        : null,
    );

    setPayments(
      ((paymentsRes.data as FinancePayment[]) ?? []).map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    );
    setFunds(
      ((fundsRes.data as CondoFund[]) ?? []).map((fund) => ({
        ...fund,
        balance: Number(fund.balance),
      })),
    );
    setExpenses(
      ((expensesRes.data as (Omit<CondoExpense, 'cluster_name'> & { cluster?: unknown })[]) ?? []).map(
        (row) => {
          const cluster = Array.isArray(row.cluster) ? row.cluster[0] : row.cluster;
          const clusterName =
            cluster && typeof cluster === 'object' && 'name' in cluster
              ? String((cluster as { name: string }).name)
              : null;
          return {
            id: row.id,
            concept: row.concept,
            amount: Number(row.amount),
            category: row.category,
            expense_date: row.expense_date,
            fund_type: row.fund_type,
            expense_kind: row.expense_kind,
            status: row.status,
            cluster_id: row.cluster_id,
            cluster_name: clusterName,
          };
        },
      ),
    );
    setBankAccounts((banksRes.data as CondoBankAccount[]) ?? []);
    setLoading(false);
  }, [primary?.condominium_id, primary?.unit_id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const settlementCharges = useMemo(
    () =>
      charges.map((charge) => ({
        id: charge.id,
        amount: charge.amount,
        amount_paid: charge.amount_paid,
        due_date: charge.due_date,
        status: charge.status,
        charge_kind: charge.charge_kind ?? 'principal',
        parent_charge_id: charge.parent_charge_id ?? null,
      })),
    [charges],
  );

  const paymentTarget = useMemo(
    () => resolveNextPaymentTarget(settlementCharges, activePlan),
    [settlementCharges, activePlan],
  );

  const balanceDue = useMemo(() => unitTotalBalanceDue(settlementCharges), [settlementCharges]);

  const statement = useMemo(
    () =>
      buildUnitStatementWithBalance(
        charges.map((charge) => ({
          id: charge.id,
          concept: charge.concept,
          amount: charge.amount,
          amount_paid: charge.amount_paid,
          due_date: charge.due_date,
          status: charge.status,
        })),
        payments.map((payment) => ({
          id: payment.id,
          charge_id: payment.charge_id,
          amount: payment.amount,
          status: payment.status,
          paid_at: payment.paid_at,
          created_at: payment.created_at,
        })),
      ),
    [charges, payments],
  );

  const expenseGroups = useMemo(() => {
    const myClusterId = primary?.unit?.cluster?.id ?? null;
    const visible = filterVisibleCondoExpenses(expenses, myClusterId);
    return groupExpenses(visible);
  }, [expenses, primary?.unit?.cluster?.id]);

  const visibleExpenses = useMemo(() => {
    const myClusterId = primary?.unit?.cluster?.id ?? null;
    return filterVisibleCondoExpenses(expenses, myClusterId);
  }, [expenses, primary?.unit?.cluster?.id]);

  const pendingPaymentsCount = useMemo(
    () =>
      payments.filter((payment) =>
        ['pending_review', 'pending_second_review', 'awaiting_payment'].includes(payment.status),
      ).length,
    [payments],
  );

  const monthExpenseTotal = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return visibleExpenses
      .filter((expense) => {
        const date = new Date(expense.expense_date);
        return date.getMonth() === month && date.getFullYear() === year && expense.status === 'paid';
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [visibleExpenses]);

  return {
    charges,
    activePlan,
    payments,
    funds,
    expenses,
    visibleExpenses,
    expenseGroups,
    bankAccounts,
    paymentTarget,
    balanceDue,
    statement,
    pendingPaymentsCount,
    monthExpenseTotal,
    loading,
    refreshing,
    error,
    refresh,
  };
}
