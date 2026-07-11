import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SalesService } from "./sales.service";

const makeSeq = () => ({ next: jest.fn().mockResolvedValue("SO-00001") }) as any;

describe("SalesService", () => {
  function makePrisma() {
    return {
      customer: { findUnique: jest.fn() },
      salesOrder: {
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

  it("rejects creation when customer belongs to another book", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B2" });
    const svc = new SalesService(prisma, makeSeq());
    await expect(
      svc.createOrder("B1", { customerId: "c1", date: "2025-01-01", lines: [] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates an order with computed line totals and tax", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B1" });
    prisma.taxCode.findMany.mockResolvedValue([{ id: "t1", rate: 8 }]); // 8 (percent)
    prisma.salesOrder.create.mockResolvedValue({ id: "so1", number: "SO-00001", total: 108 });
    const svc = new SalesService(prisma, makeSeq());
    const result = await svc.createOrder("B1", {
      customerId: "c1",
      date: "2025-01-01",
      lines: [{ description: "Widget", quantity: 1, unitPrice: 100, taxCodeId: "t1" }],
    } as never);
    expect(result).toMatchObject({ number: "SO-00001" });
    expect(prisma.salesOrder.create).toHaveBeenCalled();
    const createArgs = prisma.salesOrder.create.mock.calls[0][0];
    expect(Number(createArgs.data.total)).toBe(108);
  });

  it("falls back to dto.total when no lines provided", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B1" });
    prisma.salesOrder.create.mockResolvedValue({ id: "so1", total: 250 });
    const svc = new SalesService(prisma, makeSeq());
    await svc.createOrder("B1", { customerId: "c1", date: "2025-01-01", total: 250, lines: [] } as never);
    const createArgs = prisma.salesOrder.create.mock.calls[0][0];
    expect(Number(createArgs.data.total)).toBe(250);
    expect(createArgs.data.lines).toBeUndefined();
  });

  it("throws NotFound when deleting a missing order", async () => {
    const prisma = makePrisma();
    prisma.salesOrder.findUnique.mockResolvedValue(null);
    const svc = new SalesService(prisma, makeSeq());
    await expect(svc.deleteOrder("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFound when updating a missing order", async () => {
    const prisma = makePrisma();
    prisma.salesOrder.findUnique.mockResolvedValue(null);
    const svc = new SalesService(prisma, makeSeq());
    await expect(
      svc.updateOrder("missing", { notes: "x" } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rebuilds totals when lines are provided in update", async () => {
    const prisma = makePrisma();
    prisma.salesOrder.findUnique.mockResolvedValue({ id: "so1", accountBookId: "B1" });
    prisma.taxCode.findMany.mockResolvedValue([{ id: "t1", rate: 10 }]);
    prisma.salesOrder.update.mockResolvedValue({ id: "so1", total: 55 });
    const svc = new SalesService(prisma, makeSeq());
    await svc.updateOrder("so1", {
      lines: [{ description: "x", quantity: 1, unitPrice: 50, taxCodeId: "t1" }],
    } as never);
    const args = prisma.salesOrder.update.mock.calls[0][0];
    expect(Number(args.data.total)).toBe(55);
  });
});
