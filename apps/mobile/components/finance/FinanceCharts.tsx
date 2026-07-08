import { FilterBar } from '@/components/ui/TabStrip';
import { FINANCE_PERIOD_OPTIONS, type FinancePeriod } from '@/lib/finance-period';

export function FinancePeriodFilter({
  period,
  onChange,
}: {
  period: FinancePeriod;
  onChange: (period: FinancePeriod) => void;
}) {
  return (
    <FilterBar
      items={FINANCE_PERIOD_OPTIONS}
      active={period}
      onChange={(key) => onChange(key as FinancePeriod)}
    />
  );
}
