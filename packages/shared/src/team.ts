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
    id: 'security',
    title: 'Seguridad (acceso)',
    description: 'Guardias y control de acceso. No es el comité de vigilancia.',
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
  guard: 'Guardia de seguridad',
  staff: 'Staff mantenimiento',
};

export const COMMITTEE_KINDS = ['vigilance'] as const;
export type CommitteeKind = (typeof COMMITTEE_KINDS)[number];

export const COMMITTEE_KIND_LABELS: Record<CommitteeKind, string> = {
  vigilance: 'Comité de vigilancia',
};

export const VIGILANCE_TITLE_OPTIONS = [
  'Presidente',
  'Secretario',
  'Tesorero',
  'Vocal',
  'Integrante',
] as const;

export function isStaffRole(role: MembershipRole): boolean {
  return TEAM_STAFF_ROLES.includes(role);
}

export function staffSectionForRole(role: MembershipRole): StaffSection | undefined {
  return STAFF_SECTIONS.find((section) => section.roles.includes(role));
}
