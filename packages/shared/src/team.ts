import type { MembershipRole } from './roles';

export interface StaffSection {
  id: string;
  title: string;
  description: string;
  roles: MembershipRole[];
  defaultInviteRole: MembershipRole;
}

export const STAFF_SECTIONS: StaffSection[] = [
  {
    id: 'administrative',
    title: 'Staff administrativo',
    description: 'Administradores y mesa directiva con acceso al panel.',
    roles: ['super_admin', 'admin', 'board_member'],
    defaultInviteRole: 'admin',
  },
  {
    id: 'security',
    title: 'Seguridad',
    description: 'Guardias y control de acceso.',
    roles: ['guard'],
    defaultInviteRole: 'guard',
  },
  {
    id: 'maintenance',
    title: 'Mantenimiento',
    description: 'Personal operativo de áreas comunes y servicios.',
    roles: ['staff'],
    defaultInviteRole: 'staff',
  },
];

export const TEAM_STAFF_ROLES: MembershipRole[] = [
  'super_admin',
  'admin',
  'board_member',
  'guard',
  'staff',
];

export const STAFF_ROLE_LABELS: Record<MembershipRole, string> = {
  super_admin: 'Super administrador',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia de seguridad',
  staff: 'Personal de mantenimiento',
};

export function isStaffRole(role: MembershipRole): boolean {
  return TEAM_STAFF_ROLES.includes(role);
}

export function staffSectionForRole(role: MembershipRole): StaffSection | undefined {
  return STAFF_SECTIONS.find((section) => section.roles.includes(role));
}
