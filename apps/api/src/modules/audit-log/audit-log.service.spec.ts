import { AuditLogService } from "./audit-log.service";

function makePrisma() {
  return {
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe("AuditLogService", () => {
  it("records an entry without throwing", async () => {
    const prisma = makePrisma();
    const svc = new AuditLogService(prisma);
    await expect(
      svc.record({ accountBookId: "B1", entity: "CustomerInvoice", entityId: "i1", action: "CREATE" }),
    ).resolves.toBeUndefined();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("swallows errors silently so business flow never breaks", async () => {
    const prisma = makePrisma();
    prisma.auditLog.create.mockRejectedValue(new Error("DB down"));
    const svc = new AuditLogService(prisma);
    await expect(
      svc.record({ accountBookId: "B1", entity: "X", entityId: "y", action: "CREATE" }),
    ).resolves.toBeUndefined();
  });

  it("list() forwards the book + limit + entity filter", async () => {
    const prisma = makePrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);
    const svc = new AuditLogService(prisma);
    await svc.list("B1", 50, "CustomerInvoice");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountBookId: "B1", entity: "CustomerInvoice" },
        take: 50,
      }),
    );
  });

  it("list() caps limit at 500", async () => {
    const prisma = makePrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);
    const svc = new AuditLogService(prisma);
    await svc.list("B1", 99999);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
  });

  it("list() without entity omits the entity filter", async () => {
    const prisma = makePrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);
    const svc = new AuditLogService(prisma);
    await svc.list("B1");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountBookId: "B1" } }),
    );
  });

  it("forEntity() filters by entity and entityId", async () => {
    const prisma = makePrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);
    const svc = new AuditLogService(prisma);
    await svc.forEntity("B1", "CustomerInvoice", "i1");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountBookId: "B1", entity: "CustomerInvoice", entityId: "i1" },
      }),
    );
  });

  describe("CSV escaping (controller logic)", () => {
    // Mirrors the CSV escape rules used in audit-log.controller.ts
    function csvEscape(v: unknown): string {
      const s = String(v ?? "");
      const CSV_UNSAFE = new RegExp('[\",\\n]');
      if (CSV_UNSAFE.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    it("escapes double quotes", () => {
      expect(csvEscape('She said "hi"')).toBe('"She said ""hi"""');
    });
    it("escapes commas", () => {
      expect(csvEscape("a, b")).toBe('"a, b"');
    });
    it("escapes newlines", () => {
      const input = "line1\nline2";
      expect(csvEscape(input)).toBe('"line1\nline2"');
    });
    it("leaves safe strings alone", () => {
      expect(csvEscape("plain")).toBe("plain");
      expect(csvEscape(123)).toBe("123");
      expect(csvEscape(null)).toBe("");
    });
  });
});
