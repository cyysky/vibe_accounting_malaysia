import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RecurringService } from "./recurring.service";

describe("RecurringService", () => {
  function makePrisma() {
    return {
      customer: { findUnique: jest.fn() },
      taxCode: { findUnique: jest.fn() },
      recurringInvoice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      recurringInvoiceLine: { deleteMany: jest.fn() },
    } as any;
  }
  function makeAr() {
    return { createInvoice: jest.fn() } as any;
  }

  it("validates customer belongs to book", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B2" });
    const svc = new RecurringService(prisma, makeAr());
    await expect(
      svc.create("B1", {
        customerId: "c1", name: "Retainer", frequency: "MONTHLY", startDate: "2025-01-01",
        lines: [{ description: "x", quantity: 1, unitPrice: 100 }],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects run of inactive template", async () => {
    const prisma = makePrisma();
    prisma.recurringInvoice.findUnique.mockResolvedValue({ id: "r1", active: false });
    const svc = new RecurringService(prisma, makeAr());
    await expect(svc.run("r1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws when template missing", async () => {
    const prisma = makePrisma();
    prisma.recurringInvoice.findUnique.mockResolvedValue(null);
    const svc = new RecurringService(prisma, makeAr());
    await expect(svc.get("x")).rejects.toBeInstanceOf(NotFoundException);
  });
});
