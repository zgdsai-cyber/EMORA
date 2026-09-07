import { describe, expect, it } from 'vitest';

import { hasMinimumRole } from './roles';

describe('organization RBAC', () => {
  it('enforces OWNER, ADMIN, MEMBER, and VIEWER hierarchy', () => {
    expect(hasMinimumRole('OWNER', 'OWNER')).toBe(true);
    expect(hasMinimumRole('ADMIN', 'OWNER')).toBe(false);
    expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true);
    expect(hasMinimumRole('MEMBER', 'ADMIN')).toBe(false);
    expect(hasMinimumRole('MEMBER', 'MEMBER')).toBe(true);
    expect(hasMinimumRole('VIEWER', 'MEMBER')).toBe(false);
    expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true);
  });
});
