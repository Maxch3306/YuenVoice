/**
 * Log an audit record for state-changing operations by management/admin roles.
 * Fire-and-forget: errors are logged but do not block the request.
 *
 * The AuditLog model may not be fully initialized yet (database may not exist).
 * This function handles failures gracefully.
 */
export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { AuditLog } = await import('../models/audit-log.js').catch(() => ({
      AuditLog: null as any,
    }))

    if (!AuditLog) {
      // Model not yet available — silently skip
      return
    }

    await AuditLog.create({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata ?? null,
    })
  } catch (err) {
    // Fire-and-forget: log and continue
    console.error('[audit] Failed to write audit log:', err)
  }
}
