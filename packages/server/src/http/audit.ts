import type { Db } from '../db/client.js'
import { auditLogs } from '../db/schema.js'

// Fire-and-forget audit logging for state-changing mgmt/admin operations.
// Errors are logged, never propagated.
export async function logAudit(
  db: Db,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata ?? null,
    })
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err)
  }
}
