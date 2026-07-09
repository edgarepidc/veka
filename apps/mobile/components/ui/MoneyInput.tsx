import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, type TextInputProps } from 'react-native';

import { formatAmountInput, parseAmountInput } from '@veka/shared';

import { GlassInput } from '@/components/ui/GlassInput';

type GlassInputProps = ComponentProps<typeof GlassInput>;

export function MoneyInput({
  value,
  onChangeText,
  onBlur,
  ...props
}: Omit<GlassInputProps, 'keyboardType' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const [display, setDisplay] = useState(() => formatAmountInput(value));

  useEffect(() => {
    setDisplay(formatAmountInput(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = parseAmountInput(raw);
    if (parsed === null) return;
    onChangeText(parsed === 0 ? '' : String(parsed));
    setDisplay(parsed === 0 ? '' : formatAmountInput(parsed));
  }

  return (
    <GlassInput
      {...props}
      keyboardType="decimal-pad"
      value={display}
      onChangeText={(raw) => {
        setDisplay(raw);
        if (!raw.trim()) {
          onChangeText('');
          return;
        }
        const parsed = parseAmountInput(raw);
        if (parsed !== null) {
          onChangeText(String(parsed));
        }
      }}
      onBlur={(event) => {
        commit(display);
        onBlur?.(event);
      }}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
