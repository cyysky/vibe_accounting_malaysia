import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RecurringService } from "./recurring.service";
const makeSeq = () => ({ next: jest.fn().mockResolvedValue('TEST-00001') }) as any;


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

  describe('previewDue', () => {
    it('returns the next N dates for a MONTHLY template starting from nextRunDate', async () => {
      const prisma = makePrisma();
      prisma.recurringInvoice.findUnique.mockResolvedValue({
        id: 't1',
        accountBookId: 'B1',
        name: 'Monthly retainer',
        frequency: 'MONTHLY',
        nextRunDate: new Date('2026-07-15'),
        endDate: null,
        active: true,
      });
      const svc = new RecurringService(prisma, makeAr());
      const result = await svc.previewDue('t1', 3);
      expect(result.dates).toEqual(['2026-07-15', '2026-08-15', '2026-09-15']);
    });

    it('stops when past the endDate', async () => {
      const prisma = makePrisma();
      prisma.recurringInvoice.findUnique.mockResolvedValue({
        id: 't1',
        accountBookId: 'B1',
        name: 'Limited',
        frequency: 'MONTHLY',
        nextRunDate: new Date('2026-07-15'),
        endDate: new Date('2026-09-30'),
        active: true,
      });
      const svc = new RecurringService(prisma, makeAr());
      const result = await svc.previewDue('t1', 5);
      expect(result.dates).toEqual(['2026-07-15', '2026-08-15', '2026-09-15']);
    });
  });
});
