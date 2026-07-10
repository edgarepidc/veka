import { cardTagClass, type CardTagTone } from '@veka/shared';

type StatChipTone = CardTagTone | 'amber' | 'muted' | 'neutral';

function normalizeTone(tone: StatChipTone): CardTagTone {
  if (tone === 'amber') return 'orange';
  if (tone === 'muted' || tone === 'neutral') return 'gray';
  return tone;
}

export function StatChip({
  label,
  value,
  tone,
  hideZero,
  showValue = true,
}: {
  label: string;
  value?: number | string;
  tone: StatChipTone;
  hideZero?: boolean;
  showValue?: boolean;
}) {
  if (hideZero && typeof value === 'number' && value === 0) return null;

  const hideValueLabels = new Set(['Completo', 'Sin unidades']);
  const displayValue =
    showValue && value !== undefined && !hideValueLabels.has(label);

  return (
    <span
      className={`inline-flex items-center gap-1 ${cardTagClass(normalizeTone(tone))} px-2 py-0.5 text-[11px] font-semibold`}
    >
      <span className="opacity-90">{label}</span>
      {displayValue ? <span>{value}</span> : null}
    </span>
  );
}
