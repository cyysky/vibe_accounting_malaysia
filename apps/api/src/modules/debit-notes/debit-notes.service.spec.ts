import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DebitNotesService } from "./debit-notes.service";

const makeSeq = () => ({ next: jest.fn().mockResolvedValue("DN-00001") }) as any;
const makePosting = () => ({ postDebitNote: jest.fn().mockResolvedValue(undefined) }) as any;

describe("DebitNotesService", () => {
  function makePrisma() {
    return {
      supplier: { findUnique: jest.fn(), update: jest.fn() },
      supplierInvoice: { findUnique: jest.fn() },
      taxCode: { findUnique: jest.fn() },
      debitNote: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as any;
  }

  it("rejects creation when supplier belongs to another book", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B2" });
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await expect(
      svc.create("B1", {
        supplierId: "s1",
        date: "2025-01-01",
        reason: "x",
        lines: [{ description: "y", quantity: 1, unitPrice: 10 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects creation when referenced bill is in another book", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.supplierInvoice.findUnique.mockResolvedValue({ id: "i1", accountBookId: "B2" });
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await expect(
      svc.create("B1", {
        supplierId: "s1",
        invoiceId: "i1",
        date: "2025-01-01",
        reason: "x",
        lines: [{ description: "y", quantity: 1, unitPrice: 10 }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws when tax code cannot be resolved", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.taxCode.findUnique.mockResolvedValue(null);
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await expect(
      svc.create("B1", {
        supplierId: "s1",
        date: "2025-01-01",
        reason: "x",
        lines: [{ description: "y", quantity: 1, unitPrice: 10, taxCodeId: "t1" }],
      } as never),
    ).rejects.toThrow(/Tax code/);
  });

  it("creates an ISSUED debit note and increments supplier outstanding", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.taxCode.findUnique.mockResolvedValue({ id: "t1", code: "SVAT-08", name: "Sales 8%", rate: 0.08 });
    prisma.debitNote.create.mockResolvedValue({
      id: "dn1",
      number: "DN-00001",
      total: 108,
      status: "ISSUED",
      supplierId: "s1",
      lines: [],
    });
    prisma.debitNote.findUnique.mockResolvedValue({ id: "dn1", supplierId: "s1", total: 108, status: "ISSUED", number: "DN-00001", lines: [] });
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await svc.create("B1", {
      supplierId: "s1",
      date: "2025-01-01",
      reason: "Late fee",
      lines: [{ description: "Late fee", quantity: 1, unitPrice: 100, taxCodeId: "t1" }],
    } as never);
    expect(prisma.debitNote.create).toHaveBeenCalled();
    expect(prisma.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1" }, data: { outstanding: { increment: 108 } } }),
    );
  });

  it("does not increment supplier outstanding when status is DRAFT", async () => {
    const prisma = makePrisma();
    prisma.supplier.findUnique.mockResolvedValue({ id: "s1", accountBookId: "B1" });
    prisma.debitNote.create.mockResolvedValue({ id: "dn1", total: 50, status: "DRAFT", supplierId: "s1", lines: [] });
    prisma.debitNote.findUnique.mockResolvedValue({ id: "dn1", total: 50, status: "DRAFT", lines: [] });
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await svc.create("B1", {
      supplierId: "s1",
      date: "2025-01-01",
      reason: "Draft",
      status: "DRAFT",
      lines: [{ description: "y", quantity: 1, unitPrice: 50 }],
    } as never);
    expect(prisma.supplier.update).not.toHaveBeenCalled();
  });

  it("rejects deleting an APPLIED debit note", async () => {
    const prisma = makePrisma();
    prisma.debitNote.findUnique.mockResolvedValue({ id: "dn1", supplierId: "s1", total: 100, status: "APPLIED" });
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await expect(svc.remove("dn1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFound when get(id) does not exist", async () => {
    const prisma = makePrisma();
    prisma.debitNote.findUnique.mockResolvedValue(null);
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await expect(svc.get("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("get(id) returns the debit note with relations", async () => {
    const prisma = makePrisma();
    const full = { id: "dn1", number: "DN-1", supplier: { id: "s1" }, invoice: null, lines: [] };
    prisma.debitNote.findUnique.mockResolvedValue(full);
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await expect(svc.get("dn1")).resolves.toEqual(full);
  });

  it("list() filters by accountBook and optional supplierId", async () => {
    const prisma = makePrisma();
    prisma.debitNote.findMany.mockResolvedValue([]);
    const svc = new DebitNotesService(prisma, makeSeq(), makePosting());
    await svc.list("B1");
    expect(prisma.debitNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountBookId: "B1" } }),
    );
    await svc.list("B1", "s1");
    expect(prisma.debitNote.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { accountBookId: "B1", supplierId: "s1" } }),
    );
  });
});
