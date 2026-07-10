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
    title: 'Staff admin',
    description: 'Administradores con acceso al panel y operación diaria.',
    roles: ['super_admin', 'admin'],
    defaultInviteRole: 'admin',
  },
  {
    id: 'board',
    title: 'Mesa directiva',
    description: 'Integrantes de la mesa directiva del condominio.',
    roles: ['board_member'],
    defaultInviteRole: 'board_member',
  },
  {
    id: 'maintenance',
    title: 'Staff mantenimiento',
    description: 'Personal operativo de áreas comunes y servicios.',
    roles: ['staff'],
    defaultInviteRole: 'staff',
  },
  {
    id: 'vigilance',
    title: 'Comité de vigilancia',
    description: 'Comité de vigilancia y control de acceso / seguridad.',
    roles: ['guard'],
    defaultInviteRole: 'guard',
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
  admin: 'Staff admin',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Comité de vigilancia',
  staff: 'Staff mantenimiento',
};

export function isStaffRole(role: MembershipRole): boolean {
  return TEAM_STAFF_ROLES.includes(role);
}

export function staffSectionForRole(role: MembershipRole): StaffSection | undefined {
  return STAFF_SECTIONS.find((section) => section.roles.includes(role));
}
