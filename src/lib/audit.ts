import type { DbClient } from "./db";
import type { SessionUser } from "./auth/permissions";

export type AuditEntryInput = {
  actor: SessionUser;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  entityRef?: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

/**
 * Append an entry to the platform audit log. Call this inside the same
 * transaction as the change it describes so the log can never drift from data.
 * There is intentionally no update/delete helper: the log is append-only.
 */
export function recordAudit(client: DbClient, entry: AuditEntryInput) {
  return client.auditLog.create({
    data: {
      actorId: entry.actor.id,
      actorName: entry.actor.name,
      actorRole: entry.actor.role,
      module: entry.module,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityRef: entry.entityRef,
      fromStatus: entry.fromStatus ?? null,
      toStatus: entry.toStatus ?? null,
      reason: entry.reason ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt: entry.createdAt,
    },
  });
}

export type AuditQuery = {
  module?: string;
  action?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function listAuditLog(client: DbClient, query: AuditQuery = {}) {
  const pageSize = query.pageSize ?? 25;
  const page = Math.max(1, query.page ?? 1);
  const where = {
    ...(query.module ? { module: query.module } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.q
      ? {
          OR: [
            { entityRef: { contains: query.q } },
            { actorName: { contains: query.q } },
            { reason: { contains: query.q } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    client.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    client.auditLog.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
