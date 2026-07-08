import type { GradientActionButtonProps } from '@/components/ui/GradientActionButton';
import { GradientActionButton } from '@/components/ui/GradientActionButton';

export type PaymentActionButtonProps = GradientActionButtonProps;

/** @deprecated Prefer GradientActionButton — kept for finance payment flows. */
export function PaymentActionButton(props: PaymentActionButtonProps) {
  return <GradientActionButton {...props} />;
}
