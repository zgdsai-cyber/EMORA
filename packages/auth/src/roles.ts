import { z } from 'zod';

export const organizationRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER',
]);

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

const roleRank: Record<OrganizationRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasMinimumRole(
  actualRole: OrganizationRole,
  minimumRole: OrganizationRole,
) {
  return roleRank[actualRole] >= roleRank[minimumRole];
}