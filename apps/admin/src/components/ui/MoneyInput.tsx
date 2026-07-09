'use client';

import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { formatAmountInput, parseAmountInput } from '@veka/shared';

export function MoneyInput({
  value,
  onChange,
  name,
  className = '',
  placeholder = '0',
  required,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const [display, setDisplay] = useState(() => formatAmountInput(value));

  useEffect(() => {
    setDisplay(formatAmountInput(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = parseAmountInput(raw);
    if (parsed === null) return;
    onChange(parsed === 0 ? '' : String(parsed));
    setDisplay(parsed === 0 ? '' : formatAmountInput(parsed));
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        placeholder={placeholder}
        required={name ? undefined : required}
        onChange={(event) => {
          const raw = event.target.value;
          setDisplay(raw);
          if (!raw.trim()) {
            onChange('');
            return;
          }
          const parsed = parseAmountInput(raw);
          if (parsed !== null) {
            onChange(String(parsed));
          }
        }}
        onBlur={() => commit(display)}
        className={`glass-input text-right tabular-nums ${className}`}
      />
    </>
  );
}
