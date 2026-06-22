import { formatExportAmount, rowsToCsv } from './finance-export';

export interface AccountingCategoryMap {
  movement_type: 'income' | 'expense';
  veka_category: string;
  account_code: string;
  account_name?: string | null;
  fund_type?: string | null;
}

export interface PolizaMovementInput {
  date: string;
  concept: string;
  movementType: 'income' | 'expense';
  category: string;
  amount: number;
  fundType?: string | null;
  reference: string;
  unitIdentifier?: string | null;
  clusterName?: string | null;
}

export interface PolizaExportRow {
  date: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  concept: string;
  reference: string;
  costCenter: string;
}

export const DEFAULT_INCOME_ACCOUNT_MAPS: AccountingCategoryMap[] = [
  { movement_type: 'income', veka_category: 'cuotas', account_code: '4101', account_name: 'Cuotas de mantenimiento' },
  { movement_type: 'income', veka_category: 'extraordinario', account_code: '4102', account_name: 'Ingresos extraordinarios' },
  { movement_type: 'income', veka_category: 'servicios', account_code: '4103', account_name: 'Ingresos por servicios' },
  { movement_type: 'income', veka_category: 'multas', account_code: '4104', account_name: 'Multas y recargos' },
  { movement_type: 'income', veka_category: 'otros', account_code: '4199', account_name: 'Otros ingresos' },
];

export const DEFAULT_EXPENSE_ACCOUNT_MAPS: AccountingCategoryMap[] = [
  { movement_type: 'expense', veka_category: 'mantenimiento', account_code: '5101', account_name: 'Mantenimiento' },
  { movement_type: 'expense', veka_category: 'servicios', account_code: '5102', account_name: 'Servicios' },
  { movement_type: 'expense', veka_category: 'nomina', account_code: '5103', account_name: 'Nómina' },
  { movement_type: 'expense', veka_category: 'seguridad', account_code: '5104', account_name: 'Seguridad' },
  { movement_type: 'expense', veka_category: 'administracion', account_code: '5105', account_name: 'Administración' },
  { movement_type: 'expense', veka_category: 'suministros', account_code: '5106', account_name: 'Suministros' },
  { movement_type: 'expense', veka_category: 'otros', account_code: '5199', account_name: 'Otros egresos' },
];

export const CASH_ACCOUNT_CODE = '1101';
export const CASH_ACCOUNT_NAME = 'Bancos';

export function resolveAccountMap(
  maps: AccountingCategoryMap[],
  movement: PolizaMovementInput,
): AccountingCategoryMap {
  const fundType = movement.fundType ?? null;
  const exact = maps.find(
    (map) =>
      map.movement_type === movement.movementType &&
      map.veka_category === movement.category &&
      (map.fund_type ?? null) === fundType,
  );
  if (exact) return exact;

  const byCategory = maps.find(
    (map) => map.movement_type === movement.movementType && map.veka_category === movement.category,
  );
  if (byCategory) return byCategory;

  const fallback = maps.find(
    (map) => map.movement_type === movement.movementType && map.veka_category === 'otros',
  );
  return (
    fallback ?? {
      movement_type: movement.movementType,
      veka_category: movement.category,
      account_code: movement.movementType === 'income' ? '4199' : '5199',
      account_name: movement.movementType === 'income' ? 'Otros ingresos' : 'Otros egresos',
    }
  );
}

export function buildPolizaRows(
  movements: PolizaMovementInput[],
  maps: AccountingCategoryMap[],
): PolizaExportRow[] {
  const rows: PolizaExportRow[] = [];

  for (const movement of movements) {
    const account = resolveAccountMap(maps, movement);
    const amount = Math.abs(Number(movement.amount));
    if (amount <= 0) continue;

    const costCenter = [movement.clusterName, movement.unitIdentifier].filter(Boolean).join(' · ') || 'Condominio';
    const concept = movement.concept;

    if (movement.movementType === 'income') {
      rows.push({
        date: movement.date,
        accountCode: CASH_ACCOUNT_CODE,
        accountName: CASH_ACCOUNT_NAME,
        debit: amount,
        credit: 0,
        concept,
        reference: movement.reference,
        costCenter,
      });
      rows.push({
        date: movement.date,
        accountCode: account.account_code,
        accountName: account.account_name ?? account.account_code,
        debit: 0,
        credit: amount,
        concept,
        reference: movement.reference,
        costCenter,
      });
    } else {
      rows.push({
        date: movement.date,
        accountCode: account.account_code,
        accountName: account.account_name ?? account.account_code,
        debit: amount,
        credit: 0,
        concept,
        reference: movement.reference,
        costCenter,
      });
      rows.push({
        date: movement.date,
        accountCode: CASH_ACCOUNT_CODE,
        accountName: CASH_ACCOUNT_NAME,
        debit: 0,
        credit: amount,
        concept,
        reference: movement.reference,
        costCenter,
      });
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.accountCode.localeCompare(b.accountCode));
}

export function buildPolizaCsv(
  meta: { condominiumName: string; periodLabel: string; generatedAt: string },
  rows: PolizaExportRow[],
): string {
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);

  const csvRows: (string | number)[][] = [
    ['Póliza contable', meta.condominiumName],
    ['Periodo', meta.periodLabel],
    ['Generado', meta.generatedAt],
    [],
    ['Fecha', 'Cuenta', 'Nombre cuenta', 'Debe', 'Haber', 'Concepto', 'Referencia', 'Centro de costo'],
    ...rows.map((row) => [
      row.date,
      row.accountCode,
      row.accountName,
      row.debit > 0 ? formatExportAmount(row.debit) : '',
      row.credit > 0 ? formatExportAmount(row.credit) : '',
      row.concept,
      row.reference,
      row.costCenter,
    ]),
    [],
    ['Totales', '', '', formatExportAmount(totalDebit), formatExportAmount(totalCredit), '', '', ''],
  ];

  return rowsToCsv(csvRows);
}
