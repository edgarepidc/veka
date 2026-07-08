export const MEMBERSHIP_ROLES = [
  'super_admin',
  'admin',
  'board_member',
  'resident',
  'guard',
  'staff',
] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const ADMIN_ROLES: MembershipRole[] = ['super_admin', 'admin'];
export const SECURITY_PANEL_ROLES: MembershipRole[] = ['super_admin', 'admin', 'guard', 'staff'];
export const STAFF_ROLES: MembershipRole[] = ['super_admin', 'admin', 'guard', 'staff'];
export const MAINTENANCE_FIELD_ROLES: MembershipRole[] = ['staff'];
export const SECURITY_FIELD_ROLES: MembershipRole[] = ['guard'];
export const FINANCE_VIEW_ROLES: MembershipRole[] = [
  'super_admin',
  'admin',
  'board_member',
  'resident',
];

export function isAdminRole(role: MembershipRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canAccessSecurityPanel(role: MembershipRole): boolean {
  return SECURITY_PANEL_ROLES.includes(role);
}

export function isMaintenanceFieldRole(role: MembershipRole | string): boolean {
  return MAINTENANCE_FIELD_ROLES.includes(role as MembershipRole);
}

export function isGuardFieldRole(role: MembershipRole | string): boolean {
  return SECURITY_FIELD_ROLES.includes(role as MembershipRole);
}

export function isFieldStaffAppRole(role: MembershipRole | string): boolean {
  return isMaintenanceFieldRole(role) || isGuardFieldRole(role);
}
