import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PurchaseService } from "./purchase.service";

const makeSeq = () => ({ next: jest.fn().mockResolvedValue("PO-00001") }) as any;

describe("PurchaseService", () => {
  function makePrisma() {
    return {
      supplier: { findUnique: jest.fn() },
      purchaseOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      taxCode: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
  }

  it("rejects creation when supplier belongs to another book", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B2" });
    const svc = new PurchaseService(prisma, makeSeq());
    await expect(
      svc.createOrder("B1", { supplierId: "s1", date: "2025-01-01", lines: [] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates an order with computed line totals and tax", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.taxCode.findMany.mockResolvedValue([{ id: "t1", rate: 6 }]); // 6% sales tax
    prisma.purchaseOrder.create.mockResolvedValue({ id: "po1", number: "PO-00001", total: 106 });
    const svc = new PurchaseService(prisma, makeSeq());
    const result = await svc.createOrder("B1", {
      supplierId: "s1",
      date: "2025-01-01",
      lines: [{ description: "Raw mat", quantity: 1, unitPrice: 100, taxCodeId: "t1" }],
    } as never);
    expect(result).toMatchObject({ number: "PO-00001" });
    const createArgs = prisma.purchaseOrder.create.mock.calls[0][0];
    expect(Number(createArgs.data.total)).toBe(106);
  });

  it("falls back to dto.total when no lines provided", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.purchaseOrder.create.mockResolvedValue({ id: "po1", total: 999 });
    const svc = new PurchaseService(prisma, makeSeq());
    await svc.createOrder("B1", { supplierId: "s1", date: "2025-01-01", total: 999, lines: [] } as never);
    const createArgs = prisma.purchaseOrder.create.mock.calls[0][0];
    expect(Number(createArgs.data.total)).toBe(999);
    expect(createArgs.data.lines).toBeUndefined();
  });

  it("throws NotFound when deleting a missing order", async () => {
    const prisma = makePrisma();
    prisma.purchaseOrder.findUnique.mockResolvedValue(null);
    const svc = new PurchaseService(prisma, makeSeq());
    await expect(svc.deleteOrder("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rebuilds totals when lines are provided in update", async () => {
    const prisma = makePrisma();
    prisma.purchaseOrder.findUnique.mockResolvedValue({ id: "po1", accountBookId: "B1" });
    prisma.taxCode.findMany.mockResolvedValue([{ id: "t1", rate: 5 }]);
    prisma.purchaseOrder.update.mockResolvedValue({ id: "po1", total: 210 });
    const svc = new PurchaseService(prisma, makeSeq());
    await svc.updateOrder("po1", {
      lines: [{ description: "x", quantity: 2, unitPrice: 100, taxCodeId: "t1" }],
    } as never);
    const args = prisma.purchaseOrder.update.mock.calls[0][0];
    expect(Number(args.data.total)).toBe(210);
  });
});
