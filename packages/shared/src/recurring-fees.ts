import type { RecurringFeeAmountMode, RecurringFeeStatus } from './constants';
import { applyCoefficient } from './finance-analytics';
import { parseAmountInput } from './money-input';

export const RECURRING_FEE_STATUS_LABELS: Record<RecurringFeeStatus, string> = {
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

export const RECURRING_FEE_AMOUNT_MODE_LABELS: Record<RecurringFeeAmountMode, string> = {
  fixed: 'Monto fijo',
  variable: 'Consumo variable',
};

export interface FeeRevision {
  base_amount: number;
  effective_from: string;
}

export function recurringFeeStatusLabel(status: RecurringFeeStatus): string {
  return RECURRING_FEE_STATUS_LABELS[status];
}

export function recurringFeeAmountModeLabel(mode: RecurringFeeAmountMode): string {
  return RECURRING_FEE_AMOUNT_MODE_LABELS[mode];
}

export function defaultVariableFeeConcept(clusterName?: string): string {
  if (clusterName) return `Gas centralizado — ${clusterName}`;
  return 'Gas centralizado';
}

export function monthStartFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function currentPeriodMonth(date = new Date()): string {
  return monthStartFromParts(date.getFullYear(), date.getMonth() + 1);
}

export function nextPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number);
  const d = new Date(y!, m!, 1);
  d.setMonth(d.getMonth() + 1);
  return monthStartFromParts(d.getFullYear(), d.getMonth() + 1);
}

export function dueDateInMonth(year: number, month: number, dueDay: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dueDateForPeriodMonth(periodMonth: string, dueDay: number): string {
  const [year, month] = periodMonth.split('-').map(Number);
  return dueDateInMonth(year!, month!, dueDay);
}

export function resolveBaseAmount(revisions: FeeRevision[], periodMonth: string): number {
  if (revisions.length === 0) return 0;
  const sorted = [...revisions].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  const match = sorted.find((revision) => revision.effective_from <= periodMonth);
  return Number(match?.base_amount ?? sorted[sorted.length - 1]!.base_amount);
}

export function unitChargeAmount(baseAmount: number, coefficient: number): number {
  return applyCoefficient(baseAmount, coefficient);
}

export function periodLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split('-').map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

export interface VariableFeeCsvUnit {
  id: string;
  identifier: string;
}

export interface VariableFeeCsvParseResult {
  amountsByUnitId: Record<string, string>;
  matched: number;
  skippedEmpty: number;
  unknownUnits: string[];
  invalidRows: string[];
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeUnitKey(value: string): string {
  return value.trim().toLowerCase();
}

/** CSV template: unidad,monto[,notas] with one row per unit. */
export function buildVariableFeeCaptureCsv(
  units: VariableFeeCsvUnit[],
  amountsByUnitId: Record<string, string | number> = {},
): string {
  const lines = ['unidad,monto,notas'];
  for (const unit of units) {
    const amount = amountsByUnitId[unit.id];
    const amountCell =
      amount === undefined || amount === null || String(amount).trim() === ''
        ? ''
        : String(amount).replace(/,/g, '');
    lines.push(`${unit.identifier},${amountCell},`);
  }
  return `${lines.join('\n')}\n`;
}

export function parseVariableFeeCaptureCsv(
  csvText: string,
  units: VariableFeeCsvUnit[],
): VariableFeeCsvParseResult {
  const unitByIdentifier = new Map(
    units.map((unit) => [normalizeUnitKey(unit.identifier), unit.id] as const),
  );

  const amountsByUnitId: Record<string, string> = {};
  const unknownUnits: string[] = [];
  const invalidRows: string[] = [];
  let matched = 0;
  let skippedEmpty = 0;

  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { amountsByUnitId, matched, skippedEmpty, unknownUnits, invalidRows };
  }

  let startIndex = 0;
  const headerCells = splitCsvLine(lines[0]!).map((cell) => normalizeUnitKey(cell));
  if (headerCells.includes('unidad') || headerCells.includes('monto')) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const identifier = cells[0] ?? '';
    const amountRaw = cells[1] ?? '';

    if (!identifier) {
      invalidRows.push(`Fila ${i + 1}: falta unidad`);
      continue;
    }

    const unitId = unitByIdentifier.get(normalizeUnitKey(identifier));
    if (!unitId) {
      unknownUnits.push(identifier);
      continue;
    }

    if (!amountRaw.trim()) {
      skippedEmpty += 1;
      continue;
    }

    const amount = parseAmountInput(amountRaw);
    if (amount === null || amount < 0) {
      invalidRows.push(`Fila ${i + 1} (${identifier}): monto inválido`);
      continue;
    }

    if (amount === 0) {
      skippedEmpty += 1;
      continue;
    }

    amountsByUnitId[unitId] = String(amount);
    matched += 1;
  }

  return { amountsByUnitId, matched, skippedEmpty, unknownUnits, invalidRows };
}
