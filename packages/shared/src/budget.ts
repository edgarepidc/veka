import type { ExpenseCategory, FundType, IncomeCategory, ReserveIncomeBase, ReserveBudgetMode } from './constants';
import { parseAmountInput } from './money-input';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RESERVE_EXPENSE_CATEGORIES,
  RESERVE_INCOME_CATEGORIES,
} from './constants';
import {
  inFinancePeriod,
  roundMoney,
  type PeriodMode,
} from './finance-analytics';
import { paymentIncomeCategory } from './fees';
import { expenseCategoryLabel } from './finance';
import { incomeCategoryLabel, reserveExpenseCategoryLabel } from './finance-scope';

export type BudgetLineKind = 'expense' | 'income';

export interface BudgetLineInput {
  line_kind: BudgetLineKind;
  category: string;
  annual_amount: number;
}

export interface BudgetLineRow extends BudgetLineInput {
  id?: string;
}

export interface ExpenseForBudget {
  amount: number;
  category: string;
  expense_date: string;
  status: string;
  fund_type: FundType;
}

export interface IncomeForBudget {
  amount: number;
  category: string;
  income_date: string;
  fund_type?: FundType;
}

export interface PaymentForBudget {
  amount: number;
  status: string;
  paid_at?: string | null;
  created_at?: string;
  charge?: {
    charge_kind?: string;
    fund_type?: FundType;
    fee_campaign?: { scope: string } | null;
    recurring_fee?: { scope: string } | null;
  } | null;
}

export interface AnnualBudgetReserveMeta {
  fund_type: FundType;
  reserve_mode?: ReserveBudgetMode | null;
  reserve_percent?: number | null;
  reserve_income_base?: ReserveIncomeBase | null;
  lines?: BudgetLineRow[];
}

export interface BudgetVsActualRow {
  category: string;
  label: string;
  budget: number;
  actual: number;
  variance: number;
  percentUsed: number | null;
}

export interface BudgetSummary {
  expenseRows: BudgetVsActualRow[];
  incomeRows: BudgetVsActualRow[];
  totalExpenseBudget: number;
  totalExpenseActual: number;
  totalIncomeBudget: number;
  totalIncomeActual: number;
  expensePercentUsed: number | null;
  incomePercentUsed: number | null;
  proratedNote: string | null;
}

function incomePaymentDate(payment: PaymentForBudget): string {
  return payment.paid_at ?? payment.created_at ?? '';
}

function expenseInPeriod(
  expense: ExpenseForBudget,
  periodMode: PeriodMode,
  year: number,
  month: number,
  reference: Date,
): boolean {
  if (expense.status !== 'paid') return false;
  return inFinancePeriod(expense.expense_date, periodMode, year, month, reference);
}

function incomeInPeriod(
  payment: PaymentForBudget,
  periodMode: PeriodMode,
  year: number,
  month: number,
  reference: Date,
): boolean {
  if (payment.status !== 'approved') return false;
  return inFinancePeriod(incomePaymentDate(payment), periodMode, year, month, reference);
}

function manualIncomeInPeriod(
  income: IncomeForBudget,
  periodMode: PeriodMode,
  year: number,
  month: number,
  reference: Date,
): boolean {
  return inFinancePeriod(income.income_date, periodMode, year, month, reference);
}

export function budgetProrateRatio(clusterUnitCount: number, totalUnitCount: number, scoped: boolean): number {
  if (!scoped || totalUnitCount <= 0) return 1;
  return clusterUnitCount / totalUnitCount;
}

function periodBudgetFactor(
  periodMode: PeriodMode,
  fiscalYear: number,
  month: number,
  reference = new Date(),
): { factor: number; label: string } {
  if (periodMode === 'month') {
    return { factor: 1 / 12, label: 'mensual (1/12 del anual)' };
  }

  const refYear = reference.getFullYear();
  if (fiscalYear < refYear) {
    return { factor: 1, label: 'anual completo' };
  }
  if (fiscalYear > refYear) {
    return { factor: 0, label: 'año futuro' };
  }

  const monthsElapsed = reference.getMonth() + 1;
  return { factor: monthsElapsed / 12, label: `acumulado a ${monthsElapsed} meses` };
}

function categoryLabel(kind: BudgetLineKind, category: string, fundType: FundType): string {
  if (fundType === 'reserve') {
    if (kind === 'expense') return reserveExpenseCategoryLabel(category);
    return incomeCategoryLabel(category);
  }
  if (kind === 'expense') return expenseCategoryLabel(category);
  return incomeCategoryLabel(category);
}

function buildRows(
  kind: BudgetLineKind,
  categories: readonly string[],
  budgetLines: BudgetLineRow[],
  actualByCategory: Record<string, number>,
  budgetFactor: number,
  prorate: number,
  fundType: FundType,
): BudgetVsActualRow[] {
  const budgetMap = new Map(
    budgetLines.filter((line) => line.line_kind === kind).map((line) => [line.category, line.annual_amount]),
  );

  return categories
    .map((category) => {
      const annual = budgetMap.get(category) ?? 0;
      const budget = roundMoney(annual * budgetFactor * prorate);
      const actual = roundMoney(actualByCategory[category] ?? 0);
      const variance = roundMoney(actual - budget);
      const percentUsed = budget > 0 ? roundMoney((actual / budget) * 100) : null;
      return {
        category,
        label: categoryLabel(kind, category, fundType),
        budget,
        actual,
        variance,
        percentUsed,
      };
    })
    .filter((row) => row.budget > 0 || row.actual > 0);
}

export function sumOperatingIncomeBudget(
  operatingLines: BudgetLineRow[],
  base: ReserveIncomeBase = 'total',
): number {
  const incomeLines = operatingLines.filter((line) => line.line_kind === 'income');
  if (base === 'fees') {
    return incomeLines.find((line) => line.category === 'cuotas')?.annual_amount ?? 0;
  }
  return roundMoney(incomeLines.reduce((sum, line) => sum + line.annual_amount, 0));
}

export function computePercentReserveContribution(
  operatingLines: BudgetLineRow[],
  percent: number,
  base: ReserveIncomeBase = 'total',
): number {
  const baseAmount = sumOperatingIncomeBudget(operatingLines, base);
  return roundMoney(baseAmount * (percent / 100));
}

export function resolveReserveBudgetLines(
  reserveBudget: AnnualBudgetReserveMeta | undefined,
  operatingLines: BudgetLineRow[],
): BudgetLineRow[] {
  if (!reserveBudget || reserveBudget.fund_type !== 'reserve') {
    return reserveBudget?.lines ?? [];
  }

  const mode = reserveBudget.reserve_mode ?? 'percent';
  if (mode === 'percent') {
    const percent = reserveBudget.reserve_percent ?? 15;
    const base = reserveBudget.reserve_income_base ?? 'total';
    const amount = computePercentReserveContribution(operatingLines, percent, base);
    if (amount <= 0) return [];
    return [{ line_kind: 'income', category: 'aportacion', annual_amount: amount }];
  }

  return reserveBudget.lines ?? [];
}

export function buildBudgetSummary({
  fiscalYear,
  periodMode,
  month,
  fundType,
  budgetLines,
  expenses,
  incomeEntries,
  payments,
  prorateRatio = 1,
  scoped = false,
  reference = new Date(),
}: {
  fiscalYear: number;
  periodMode: PeriodMode;
  month: number;
  fundType: FundType;
  budgetLines: BudgetLineRow[];
  expenses: ExpenseForBudget[];
  incomeEntries: IncomeForBudget[];
  payments: PaymentForBudget[];
  prorateRatio?: number;
  scoped?: boolean;
  reference?: Date;
}): BudgetSummary {
  const { factor, label: factorLabel } = periodBudgetFactor(periodMode, fiscalYear, month, reference);
  const prorate = scoped ? prorateRatio : 1;

  const expenseActual: Record<string, number> = {};
  for (const expense of expenses) {
    if (expense.fund_type !== fundType) continue;
    if (!expenseInPeriod(expense, periodMode, fiscalYear, month, reference)) continue;
    expenseActual[expense.category] = roundMoney((expenseActual[expense.category] ?? 0) + Number(expense.amount));
  }

  const incomeActual: Record<string, number> = {};
  for (const payment of payments) {
    if (!incomeInPeriod(payment, periodMode, fiscalYear, month, reference)) continue;
    const paymentFund = payment.charge?.fund_type ?? 'operating';
    if (paymentFund !== fundType) continue;
    const category =
      fundType === 'reserve'
        ? 'aportacion'
        : paymentIncomeCategory(payment.charge ?? null);
    incomeActual[category] = roundMoney((incomeActual[category] ?? 0) + Number(payment.amount));
  }
  for (const income of incomeEntries) {
    const incomeFund = income.fund_type ?? 'operating';
    if (incomeFund !== fundType) continue;
    if (!manualIncomeInPeriod(income, periodMode, fiscalYear, month, reference)) continue;
    const category =
      fundType === 'reserve' && !RESERVE_INCOME_CATEGORIES.includes(income.category as (typeof RESERVE_INCOME_CATEGORIES)[number])
        ? 'aportacion'
        : income.category;
    incomeActual[category] = roundMoney((incomeActual[category] ?? 0) + Number(income.amount));
  }

  const expenseCategories = fundType === 'reserve' ? RESERVE_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES;
  const incomeCategories = fundType === 'reserve' ? RESERVE_INCOME_CATEGORIES : INCOME_CATEGORIES;

  const expenseRows = buildRows(
    'expense',
    expenseCategories,
    budgetLines,
    expenseActual,
    factor,
    prorate,
    fundType,
  );
  const incomeRows = buildRows(
    'income',
    incomeCategories,
    budgetLines,
    incomeActual,
    factor,
    prorate,
    fundType,
  );

  const totalExpenseBudget = roundMoney(expenseRows.reduce((sum, row) => sum + row.budget, 0));
  const totalExpenseActual = roundMoney(expenseRows.reduce((sum, row) => sum + row.actual, 0));
  const totalIncomeBudget = roundMoney(incomeRows.reduce((sum, row) => sum + row.budget, 0));
  const totalIncomeActual = roundMoney(incomeRows.reduce((sum, row) => sum + row.actual, 0));

  const proratedNote =
    scoped && prorate < 1
      ? `Presupuesto prorrateado al ${Math.round(prorate * 100)}% del condominio (${factorLabel}).`
      : factorLabel !== 'anual completo' && factorLabel !== 'mensual (1/12 del anual)'
        ? `Presupuesto ${factorLabel}.`
        : scoped && prorate < 1
          ? `Presupuesto prorrateado al ${Math.round(prorate * 100)}% del condominio.`
          : null;

  return {
    expenseRows,
    incomeRows,
    totalExpenseBudget,
    totalExpenseActual,
    totalIncomeBudget,
    totalIncomeActual,
    expensePercentUsed:
      totalExpenseBudget > 0 ? roundMoney((totalExpenseActual / totalExpenseBudget) * 100) : null,
    incomePercentUsed:
      totalIncomeBudget > 0 ? roundMoney((totalIncomeActual / totalIncomeBudget) * 100) : null,
    proratedNote,
  };
}

export function findAnnualBudget<
  T extends { fiscal_year: number; fund_type: FundType; cluster_id?: string | null },
>(budgets: T[], fiscalYear: number, fundType: FundType, clusterId = ''): T | undefined {
  return budgets.find(
    (budget) =>
      budget.fiscal_year === fiscalYear &&
      budget.fund_type === fundType &&
      (clusterId ? budget.cluster_id === clusterId : !budget.cluster_id),
  );
}

export function parseBudgetAmount(value: string): number | null {
  return parseAmountInput(value);
}

export function isValidBudgetCategory(
  kind: BudgetLineKind,
  category: string,
  fundType: FundType = 'operating',
): boolean {
  if (fundType === 'reserve') {
    if (kind === 'expense') {
      return RESERVE_EXPENSE_CATEGORIES.includes(category as (typeof RESERVE_EXPENSE_CATEGORIES)[number]);
    }
    return RESERVE_INCOME_CATEGORIES.includes(category as (typeof RESERVE_INCOME_CATEGORIES)[number]);
  }
  if (kind === 'expense') {
    return EXPENSE_CATEGORIES.includes(category as ExpenseCategory);
  }
  return INCOME_CATEGORIES.includes(category as IncomeCategory);
}
