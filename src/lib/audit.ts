import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

interface AuditLogEntry {
  actorId: string;
  societyId: string;
  action: string;
  entity: string;
  entityId?: string;
  prevState?: any;
  newState?: any;
  ip?: string;
  tx?: any;
}

// In-memory dead-letter buffer for audit failures (retained for telemetry/inspection/replay)
const auditDeadLetterQueue: Array<{ entry: Omit<AuditLogEntry, "tx">; error: string; timestamp: string }> = [];

export function getAuditDeadLetterQueue() {
  return [...auditDeadLetterQueue];
}

export function clearAuditDeadLetterQueue() {
  auditDeadLetterQueue.length = 0;
}

export async function audit(params: AuditLogEntry) {
  try {
    // Use the restricted app_user connection (db), NOT ownerDb, so that
    // REVOKE UPDATE, DELETE ON audit_logs FROM app_user is actually enforced.
    // ownerDb bypasses RLS and privilege restrictions — never use it here.
    const dbClient = params.tx || db;
    await dbClient.insert(auditLogs).values({
      actorId: params.actorId,
      societyId: params.societyId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      prevState: params.prevState,
      newState: params.newState,
      ip: params.ip,
    });
  } catch (err: any) {
    // Record in local dead-letter queue so telemetry or retry can recover the audit log
    const { tx: _, ...safeEntry } = params;
    const failureRecord = {
      entry: safeEntry,
      error: err?.message || String(err),
      timestamp: new Date().toISOString(),
    };
    if (auditDeadLetterQueue.length > 500) {
      auditDeadLetterQueue.shift(); // Bound memory
    }
    auditDeadLetterQueue.push(failureRecord);

    // Log loudly — a silent audit failure is a compliance violation.
    console.error("[AUDIT CRITICAL] Failed to record audit log — retained in dead-letter buffer:", {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      actorId: params.actorId,
      error: err,
    });
  }
}
