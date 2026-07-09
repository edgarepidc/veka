import { roundMoney } from './finance-analytics';

/** Strip grouping separators and parse a monetary amount from user input. */
export function parseAmountInput(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return roundMoney(amount);
}

/** Format a number for display inside amount inputs (comma thousands, up to 2 decimals). */
export function formatAmountInput(value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';

  const amount =
    typeof value === 'number'
      ? value
      : (() => {
          const parsed = parseAmountInput(value);
          return parsed === null ? NaN : parsed;
        })();

  if (!Number.isFinite(amount)) {
    return typeof value === 'string' ? value : '';
  }

  if (amount === 0 && (value === '0' || value === 0)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
