import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CreditNotesService } from "./credit-notes.service";
const makeSeq = () => ({ next: jest.fn().mockResolvedValue('TEST-00001') }) as any;


describe("CreditNotesService", () => {
  function makePrisma() {
    return {
      customer: { findUnique: jest.fn(), update: jest.fn() },
      customerInvoice: { findUnique: jest.fn() },
      taxCode: { findUnique: jest.fn() },
      creditNote: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    } as any;
  }
  function makePosting() {
    return { postCreditNote: jest.fn() } as any;
  }

  it("throws if customer not in book", async () => {
    const prisma = makePrisma();
    prisma.customer.findUnique.mockResolvedValue({ id: "c1", accountBookId: "B2" });
    const svc = new CreditNotesService(prisma, makeSeq(), makePosting());
    await expect(
      svc.create("B1", {
        customerId: "c1", date: "2025-01-01", reason: "x", lines: [{ description: "y", quantity: 1, unitPrice: 10 }],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects deleting an APPLIED credit note", async () => {
    const prisma = makePrisma();
    prisma.creditNote.findUnique.mockResolvedValue({ id: "cn1", customerId: "c1", total: 100, status: "APPLIED" });
    prisma.customer.update.mockResolvedValue({});
    const svc = new CreditNotesService(prisma, makeSeq(), makePosting());
    await expect(svc.remove("cn1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws if credit note not found", async () => {
    const prisma = makePrisma();
    prisma.creditNote.findUnique.mockResolvedValue(null);
    const svc = new CreditNotesService(prisma, makeSeq(), makePosting());
    await expect(svc.remove("x")).rejects.toBeInstanceOf(NotFoundException);
  });
});
