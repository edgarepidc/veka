'use client';

import { useState } from 'react';

import { MoneyInput } from '@/components/ui/MoneyInput';

export function MoneyField({
  name,
  defaultValue = '',
  className = '',
  placeholder = '0',
  required,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <MoneyInput
      name={name}
      value={value}
      onChange={setValue}
      className={className}
      placeholder={placeholder}
      required={required}
    />
  );
}
