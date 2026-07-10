import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

export interface AuditEntryInput {
  accountBookId: string;
  userId?: string;
  entity: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "POST" | "SUBMIT" | "CANCEL" | "POLL" | "PAY";
  message?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget audit logging; never throw. */
  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          accountBookId: entry.accountBookId,
          userId: entry.userId,
          entity: entry.entity,
          entityId: entry.entityId,
          action: entry.action,
          message: entry.message,
          payload: entry.payload ? (entry.payload as never) : undefined,
        },
      });
    } catch {
      // audit failures must never break business logic
    }
  }

  list(bookId: string, limit = 100, entity?: string) {
    return this.prisma.auditLog.findMany({
      where: { accountBookId: bookId, ...(entity ? { entity } : {}) },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(500, Math.max(1, limit)),
    });
  }

  forEntity(bookId: string, entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { accountBookId: bookId, entity, entityId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}
