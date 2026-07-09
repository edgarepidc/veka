import { cardTagClass, type CardTagTone } from '@veka/shared';

export function StatusTag({ label, tone }: { label: string; tone: CardTagTone }) {
  return <span className={cardTagClass(tone)}>{label}</span>;
}
