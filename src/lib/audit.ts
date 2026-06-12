import { prisma } from "./prisma";

type AuditInput = {
  actorUserId?: string | bigint | null;
  action: string; // e.g. "category.create"
  entityType: string; // e.g. "Category"
  entityId?: string | bigint | null;
  before?: unknown;
  after?: unknown;
};

/** Write an audit-trail entry. Never throws — auditing must not break the action. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ? BigInt(input.actorUserId) : null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ? BigInt(input.entityId) : null,
        beforeJson: input.before ? (input.before as object) : undefined,
        afterJson: input.after ? (input.after as object) : undefined,
      },
    });
  } catch (e) {
    console.error("audit write failed", e);
  }
}
