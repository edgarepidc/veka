export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

export interface AppTheme {
  mode: ThemeMode;
  background: string;
  gradient: readonly [string, string];
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accent2: string;
  accent3: string;
  danger: string;
  purple: string;
  success: string;
  warning: string;
  tabBar: string;
  tabBarBorder: string;
  shadow: string;
  onAccent: string;
  input: string;
  inputBorder: string;
  serifFamily: string;
  sansFamily: string;
  /** @deprecated use surface */
  glass: string;
  /** @deprecated use surfaceMuted */
  glassDeep: string;
  /** @deprecated use border */
  glassBorder: string;
}

/**
 * Paleta inspirada en benchmarks SaaS (shadcn/ui, AdminLTE, getcolors.dev):
 * - Fondo neutro claro #F4F6F9, superficies blancas, primario azul #2563EB
 * - Dark: slate #0F172A / #1E293B, primario #3B82F6
 */
export const themes: Record<ThemeMode, AppTheme> = {
  light: {
    mode: 'light',
    background: '#FFFFFF',
    gradient: ['#FFFFFF', '#F8FAFC'],
    surface: '#FFFFFF',
    surfaceMuted: '#F7F7F7',
    border: '#EBEBEB',
    text: '#1E293B',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    accent: '#2563EB',
    accent2: '#0EA5E9',
    accent3: '#F59E0B',
    danger: '#DC2626',
    purple: '#7C3AED',
    success: '#059669',
    warning: '#D97706',
    tabBar: '#FFFFFF',
    tabBarBorder: '#EBEBEB',
    shadow: 'rgba(15, 23, 42, 0.08)',
    onAccent: '#FFFFFF',
    input: '#FFFFFF',
    inputBorder: '#EBEBEB',
    serifFamily: 'DMSerifDisplay_400Regular',
    sansFamily: 'DMSans_400Regular',
    glass: '#FFFFFF',
    glassDeep: '#F1F5F9',
    glassBorder: '#EBEBEB',
  },
  dark: {
    mode: 'dark',
    background: '#0F172A',
    gradient: ['#0F172A', '#111827'],
    surface: '#1E293B',
    surfaceMuted: '#334155',
    border: '#475569',
    text: '#F8FAFC',
    textMuted: '#CBD5E1',
    textSubtle: '#94A3B8',
    accent: '#3B82F6',
    accent2: '#38BDF8',
    accent3: '#FBBF24',
    danger: '#F87171',
    purple: '#A78BFA',
    success: '#34D399',
    warning: '#FBBF24',
    tabBar: '#1E293B',
    tabBarBorder: '#475569',
    shadow: 'rgba(0, 0, 0, 0.35)',
    onAccent: '#FFFFFF',
    input: '#1E293B',
    inputBorder: '#475569',
    serifFamily: 'DMSerifDisplay_400Regular',
    sansFamily: 'DMSans_400Regular',
    glass: '#1E293B',
    glassDeep: '#334155',
    glassBorder: '#475569',
  },
};

export type TagTone = 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'gray';

export function tagColors(theme: AppTheme, tone: TagTone) {
  const map = {
    green: { bg: `${theme.success}18`, text: theme.success, border: `${theme.success}33` },
    blue: { bg: `${theme.accent}18`, text: theme.accent, border: `${theme.accent}33` },
    orange: { bg: `${theme.accent3}18`, text: theme.accent3, border: `${theme.accent3}33` },
    red: { bg: `${theme.danger}18`, text: theme.danger, border: `${theme.danger}33` },
    purple: { bg: `${theme.purple}18`, text: theme.purple, border: `${theme.purple}33` },
    gray: { bg: theme.surfaceMuted, text: theme.textMuted, border: theme.border },
  } as const;
  return map[tone];
}
