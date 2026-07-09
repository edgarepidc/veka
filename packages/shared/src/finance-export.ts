export function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function formatExportAmount(amount: number): string {
  return amount.toFixed(2);
}

export function formatExportDate(date = new Date()): string {
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function sanitizeExportFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export interface FinancialReportExport {
  condominiumName: string;
  periodLabel: string;
  scopeLabel: string;
  generatedAt: string;
  kpis: { label: string; value: string; change?: string | null }[];
  incomeByCategory: { label: string; amount: number }[];
  expenseByCategory: { label: string; amount: number }[];
  budgetRows: { label: string; budget: number; actual: number; variance: number }[];
  fundBalances: { label: string; amount: number; asOf: string }[];
  agingRows: { label: string; amount: number }[];
  totalReceivable: number;
  totalPayables: number;
  collectionRate: number | null;
}

export function buildFinancialReportCsv(report: FinancialReportExport): string {
  const rows: (string | number)[][] = [
    ['Reporte financiero', report.condominiumName],
    ['Periodo', report.periodLabel],
    ['Alcance', report.scopeLabel],
    ['Generado', report.generatedAt],
    [],
    ['Resumen'],
    ['Concepto', 'Valor', 'Variación vs periodo anterior'],
    ...report.kpis.map((kpi) => [kpi.label, kpi.value, kpi.change ?? '']),
    [],
    ['Cobranza y adeudos'],
    ['Tasa de cobranza', report.collectionRate !== null ? `${report.collectionRate}%` : 'N/D'],
    ['Por cobrar (vencido)', formatExportAmount(report.totalReceivable)],
    ['Proveedores pendientes', formatExportAmount(report.totalPayables)],
    [],
    ['Ingresos por categoría'],
    ['Categoría', 'Monto'],
    ...report.incomeByCategory.map((row) => [row.label, formatExportAmount(row.amount)]),
    [],
    ['Egresos por categoría'],
    ['Categoría', 'Monto'],
    ...report.expenseByCategory.map((row) => [row.label, formatExportAmount(row.amount)]),
    [],
    ['Presupuesto vs real (egresos)'],
    ['Categoría', 'Presupuesto', 'Real', 'Variación'],
    ...report.budgetRows.map((row) => [
      row.label,
      formatExportAmount(row.budget),
      formatExportAmount(row.actual),
      formatExportAmount(row.variance),
    ]),
    [],
    ['Antigüedad de morosidad'],
    ['Tramo', 'Monto'],
    ...report.agingRows.map((row) => [row.label, formatExportAmount(row.amount)]),
    [],
    ['Saldos por fondo'],
    ['Fondo', 'Saldo', 'Al'],
    ...report.fundBalances.map((row) => [
      row.label,
      formatExportAmount(row.amount),
      row.asOf,
    ]),
  ];

  return rowsToCsv(rows);
}

export interface UnitStatementExport {
  condominiumName: string;
  unitIdentifier: string;
  clusterName: string;
  balanceDue: number;
  generatedAt: string;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
  };
  lines: {
    date: string;
    concept: string;
    debit: number;
    credit: number;
    runningBalance: number;
    status: string;
  }[];
}

export function buildUnitStatementCsv(statement: UnitStatementExport): string {
  const rows: (string | number)[][] = [
    ['Estado de cuenta', statement.condominiumName],
    ['Unidad', statement.unitIdentifier],
    ['Torre', statement.clusterName],
    ['Saldo pendiente', formatExportAmount(statement.balanceDue)],
    ['Generado', statement.generatedAt],
    [],
    ['Fecha', 'Concepto', 'Cargo', 'Abono', 'Saldo', 'Estado'],
    ...statement.lines.map((line) => [
      line.date,
      line.concept,
      line.debit > 0 ? formatExportAmount(line.debit) : '',
      line.credit > 0 ? formatExportAmount(line.credit) : '',
      formatExportAmount(line.runningBalance),
      line.status,
    ]),
  ];

  return rowsToCsv(rows);
}

export interface MovementExportRow {
  movementType: 'Ingreso' | 'Egreso';
  date: string;
  concept: string;
  category: string;
  amount: number;
  fund: string;
  scope: string;
  status: string;
  reference: string;
}

export function buildMovementsCsv(
  meta: { condominiumName: string; scopeLabel: string; generatedAt: string; periodLabel?: string },
  movements: MovementExportRow[],
): string {
  const rows: (string | number)[][] = [
    ['Libro de movimientos', meta.condominiumName],
    ['Periodo', meta.periodLabel ?? 'Todos'],
    ['Alcance', meta.scopeLabel],
    ['Generado', meta.generatedAt],
    [],
    ['Tipo', 'Fecha', 'Concepto', 'Categoría', 'Monto', 'Fondo', 'Alcance', 'Estado', 'Referencia'],
    ...movements.map((row) => [
      row.movementType,
      row.date,
      row.concept,
      row.category,
      formatExportAmount(row.amount),
      row.fund,
      row.scope,
      row.status,
      row.reference,
    ]),
  ];

  return rowsToCsv(rows);
}

export interface DelinquencyAgingExportRow {
  unitIdentifier: string;
  clusterName: string;
  concept: string;
  dueDate: string;
  daysPastDue: number;
  agingBucket: string;
  balanceDue: number;
  status: string;
}

export function agingBucketLabel(days: number): string {
  if (days <= 30) return '0–30 días';
  if (days <= 60) return '31–60 días';
  if (days <= 90) return '61–90 días';
  return 'Más de 90 días';
}

export function buildDelinquencyAgingCsv(
  meta: { condominiumName: string; scopeLabel: string; generatedAt: string; totalReceivable: number },
  rows: DelinquencyAgingExportRow[],
): string {
  const csvRows: (string | number)[][] = [
    ['Corte de cartera / antigüedad', meta.condominiumName],
    ['Alcance', meta.scopeLabel],
    ['Total morosidad', formatExportAmount(meta.totalReceivable)],
    ['Generado', meta.generatedAt],
    [],
    ['Unidad', 'Torre', 'Concepto', 'Vencimiento', 'Días vencido', 'Tramo', 'Saldo', 'Estado'],
    ...rows.map((row) => [
      row.unitIdentifier,
      row.clusterName,
      row.concept,
      row.dueDate,
      row.daysPastDue,
      row.agingBucket,
      formatExportAmount(row.balanceDue),
      row.status,
    ]),
  ];

  return rowsToCsv(csvRows);
}
