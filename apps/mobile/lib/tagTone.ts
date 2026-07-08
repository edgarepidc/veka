import type { TagTone } from '@/constants/theme';

export function mapChargeTone(tone: 'default' | 'success' | 'warning' | 'danger'): TagTone {
  if (tone === 'success') return 'green';
  if (tone === 'warning') return 'orange';
  if (tone === 'danger') return 'red';
  return 'gray';
}

export function mapPaymentTone(tone: 'default' | 'success' | 'warning' | 'danger'): TagTone {
  if (tone === 'success') return 'green';
  if (tone === 'warning') return 'orange';
  if (tone === 'danger') return 'red';
  return 'blue';
}
