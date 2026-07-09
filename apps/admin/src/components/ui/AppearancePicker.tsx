'use client';

import { useThemePreference } from '@/providers/ThemeProvider';
import type { ThemePreference } from '@/lib/theme';

const OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
  { key: 'system', label: 'Sistema' },
];

export function AppearancePicker({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useThemePreference();

  return (
    <div className={`glass-tab-strip ${compact ? 'max-w-xs' : ''}`} role="group" aria-label="Apariencia">
      {OPTIONS.map((option) => {
        const active = preference === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => setPreference(option.key)}
            className={`glass-tab ${active ? 'glass-tab-active' : ''}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
