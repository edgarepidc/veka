const ADMIN_ONLY_PREFIXES = [
  '/finanzas',
  '/comunidad',
  '/espacios',
  '/mantenimiento',
  '/configuracion/unidades',
  '/configuracion/equipo',
  '/configuracion/invitaciones',
] as const;

const SECURITY_PANEL_PREFIXES = ['/seguridad'] as const;

export function isAdminOnlyPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSecurityPanelPath(pathname: string): boolean {
  return SECURITY_PANEL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function canAccessPanelPath(
  pathname: string,
  access: { isAdmin: boolean; canAccessSecurity: boolean },
): boolean {
  if (access.isAdmin) return true;
  if (isAdminOnlyPath(pathname)) return false;
  if (isSecurityPanelPath(pathname)) return access.canAccessSecurity;
  return true;
}

export function residentHomePath(): string {
  return '/mi-cuenta';
}

export function securityHomePath(): string {
  return '/seguridad';
}

export function panelHomePath(access: { isAdmin: boolean; canAccessSecurity: boolean }): string {
  if (access.isAdmin) return '/';
  if (access.canAccessSecurity) return securityHomePath();
  return residentHomePath();
}
