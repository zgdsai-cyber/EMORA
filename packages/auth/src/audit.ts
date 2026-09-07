import { db } from '@emora/database';
import { auditLogs } from '@emora/database/schema';

import { z } from 'zod';

const auditInputSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  action: z.string().min(1).max(100),
  resourceType: z.string().min(1).max(100),
  resourceId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AuditInput = z.infer<typeof auditInputSchema>;

export async function recordAuditEvent(input: AuditInput) {
  const event = auditInputSchema.parse(input);
  const [auditLog] = await db
    .insert(auditLogs)
    .values(event)
    .returning();

  return auditLog;
}
