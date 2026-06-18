const ADMIN_ONLY_PREFIXES = [
  '/finanzas',
  '/comunidad',
  '/espacios',
  '/seguridad',
  '/mantenimiento',
  '/configuracion/condominio',
  '/configuracion/unidades',
  '/configuracion/equipo',
  '/configuracion/invitaciones',
] as const;

export function isAdminOnlyPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function residentHomePath(): string {
  return '/mi-cuenta';
}
