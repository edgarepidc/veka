export interface CondominiumBranding {
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
}

export interface CondominiumSettings {
  branding?: CondominiumBranding;
}

export function parseCondominiumSettings(raw: unknown): CondominiumSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as CondominiumSettings;
}

export const DEFAULT_BRANDING: Required<CondominiumBranding> = {
  logo_url: '',
  primary_color: '#34d399',
  accent_color: '#38bdf8',
};
